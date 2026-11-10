using API.Common.Exceptions;
using API.Common.Security;
using API.Data.Extensions;
using API.Data.Interfaces;
using API.Models.DTOs;
using API.Models.Entities;
using API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Services.Implementations
{
    public class AuthService : IAuthService
    {
        private const string InvalidCredentialsMessage = "Sai tên đăng nhập hoặc mật khẩu";
        private const string InvalidRefreshTokenMessage = "Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
        private const string RotatedReason = "Refresh token đã được thay thế bằng một token mới (rotate).";

        // Cửa sổ ân hạn: SPA hay bắn nhiều request song song, khi access token hết hạn có thể có
        // 2 request refresh gần như cùng lúc bằng cùng 1 token. Request thứ 2 đến sau khi token đã
        // rotate ở request thứ 1 KHÔNG phải trộm token — chỉ từ chối nó, không revoke cả phiên.
        private const int RotationGraceSeconds = 30;

        // Hash BCrypt của một chuỗi ngẫu nhiên (không ai biết mật khẩu gốc), cùng work factor với hash thật.
        // Dùng khi username không tồn tại để thời gian phản hồi giống hệt trường hợp sai mật khẩu,
        // tránh kẻ tấn công dò ra username nào có thật dựa vào thời gian.
        private const string DummyPasswordHash = "$2a$11$ZNGO1hEfY3weyKZX72ap6uwfXm7rd83bFTP07iq2OLxkw5leNvo.6";

        private readonly IUnitOfWork _unitOfWork;
        private readonly JwtTokenHelper _jwtTokenHelper;
        private readonly JwtSettings _jwtSettings;
        private readonly RefreshTokenSettings _refreshTokenSettings;
        private readonly LockoutSettings _lockoutSettings;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<AuthService> _logger;

        public AuthService(IUnitOfWork unitOfWork, JwtTokenHelper jwtTokenHelper,
            IOptions<JwtSettings> jwtSettings, IOptions<RefreshTokenSettings> refreshTokenSettings, IOptions<LockoutSettings> lockoutSettings,
            TimeProvider timeProvider, ILogger<AuthService> logger)
        {
            _unitOfWork = unitOfWork;
            _jwtTokenHelper = jwtTokenHelper;
            _jwtSettings = jwtSettings.Value;
            _refreshTokenSettings = refreshTokenSettings.Value;
            _lockoutSettings = lockoutSettings.Value;
            _timeProvider = timeProvider;
            _logger = logger;
        }

        // --------------------------------------------------------------------
        // 🔹 LOGIN
        // --------------------------------------------------------------------
        public async Task<AuthResponse> LoginAsync(string username, string password, string ip, CancellationToken ct)
        {
            var now = UtcNow();

            // 1. Tìm User trong Database theo Username
            var user = await _unitOfWork.Repository<User>().Query().FirstOrDefaultAsync(u => u.UserName == username, ct);

            // 2. Đang khoá tạm: từ chối trước khi kiểm tra mật khẩu, nên thử tiếp trong lúc khoá không dò được mật khẩu đúng
            EnsureNotLockedOut(user, now);

            // 3. Kiểm tra mật khẩu bằng BCrypt. Luôn chạy Verify (kể cả khi không có user) để thời gian phản hồi như nhau
            var isPasswordValid = BCrypt.Net.BCrypt.Verify(password, user?.PasswordHash ?? DummyPasswordHash);
            if (user is null)
            {
                throw new UnauthorizedException(InvalidCredentialsMessage);
            }
            if (!isPasswordValid)
            {
                await RegisterFailedPasswordAsync(user, now, ct);
                throw new UnauthorizedException(InvalidCredentialsMessage);
            }
            await ResetFailedPasswordsAsync(user, ct);

            // Kiểm tra khoá SAU mật khẩu: người không biết mật khẩu không dò được tài khoản nào đang bị khoá.
            // Đăng nhập đúng nhưng bị khoá => 403 (đã xác thực, nhưng không được phép)
            if (!user.IsActive)
            {
                throw new ForbiddenException("Tài khoản đã bị khoá");
            }

            // 4. Tạo Refresh Token và lưu vào CSDL
            var refreshTokenEntity = BuildRefreshToken(user.Id, ip, now, out string plaintextRefreshToken);
            await _unitOfWork.Repository<RefreshToken>().AddAsync(refreshTokenEntity, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            // 5. Trả kết quả kèm Access Token
            return BuildAuthResponse(user, plaintextRefreshToken, refreshTokenEntity.ExpiresAt, now);
        }

        // --------------------------------------------------------------------
        // 🔹 REFRESH TOKEN - xoay vòng (rotate) token + phát hiện token bị dùng lại (reuse detection)
        // --------------------------------------------------------------------
        public async Task<AuthResponse> RefreshAsync(string refreshToken, string ip, CancellationToken ct)
        {
            var now = UtcNow();

            // 1. Hash token nhận được từ client để tìm trong DB
            var hashedToken = JwtTokenHelper.HashToken(refreshToken);
            var refreshTokenExisting = await _unitOfWork.Repository<RefreshToken>().Query()
                .FirstOrDefaultAsync(rt => rt.TokenHash == hashedToken, ct);

            if (refreshTokenExisting is null || refreshTokenExisting.ExpiresAt <= now)
            {
                throw new UnauthorizedException(InvalidRefreshTokenMessage);
            }

            // 2. Token đã bị thu hồi: kiểm tra có phải bị dùng lại (reuse detection) hay không
            if (refreshTokenExisting.RevokedAt is not null)
            {
                // Chỉ token bị thu hồi do rotate mới là dấu hiệu bị đánh cắp (logout thì không)
                var wasRotated = refreshTokenExisting.ReasonRevoked == RotatedReason;

                // "Tranh chấp lành tính": token vừa bị rotate trong vòng vài giây, thường do client gửi đúp request
                var isBenignRace = wasRotated && refreshTokenExisting.RevokedAt.Value > now.AddSeconds(-RotationGraceSeconds);

                // Đã quá thời gian ân hạn mà vẫn có người dùng token cũ -> nghi bị đánh cắp, thu hồi toàn bộ phiên của user
                if (wasRotated && !isBenignRace)
                {
                    await _unitOfWork.RevokeActiveRefreshTokensAsync(
                        refreshTokenExisting.UserId, ip, "Phát hiện dùng lại refresh token đã rotate (nghi ngờ bị đánh cắp)", now, ct);
                    await _unitOfWork.SaveChangesAsync(ct);
                }

                throw new UnauthorizedException(InvalidRefreshTokenMessage);
            }

            // 3. Kiểm tra User (user đã xoá mềm tự bị loại bởi global query filter)
            var user = await _unitOfWork.Repository<User>().Query().FirstOrDefaultAsync(u => u.Id == refreshTokenExisting.UserId, ct);
            if (user is null || !user.IsActive)
            {
                throw new UnauthorizedException("Tài khoản không tồn tại hoặc đã bị khoá");
            }

            // 4. ROTATE TOKEN trong 1 transaction
            return await _unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                // Thu hồi token cũ bằng UPDATE có điều kiện "RevokedAt IS NULL".
                // Hai request refresh song song: SQL Server khoá dòng, request đến sau thấy 0 dòng bị ảnh hưởng
                // => chỉ đúng 1 request rotate thành công, không thể sinh ra 2 refresh token hợp lệ.
                var affected = await _unitOfWork.Repository<RefreshToken>().QueryForEdit()
                    .Where(rt => rt.Id == refreshTokenExisting.Id && rt.RevokedAt == null)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(rt => rt.RevokedAt, now)
                        .SetProperty(rt => rt.RevokedByIp, ip)
                        .SetProperty(rt => rt.ReasonRevoked, RotatedReason), token);

                if (affected == 0)
                {
                    throw new UnauthorizedException(InvalidRefreshTokenMessage);
                }

                // Lưu token mới để có Id, rồi nối chuỗi truy vết token cũ -> token mới
                var newRefreshTokenEntity = BuildRefreshToken(user.Id, ip, now, out string plaintextNewRefreshToken);
                await _unitOfWork.Repository<RefreshToken>().AddAsync(newRefreshTokenEntity, token);
                await _unitOfWork.SaveChangesAsync(token);

                await _unitOfWork.Repository<RefreshToken>().QueryForEdit()
                    .Where(rt => rt.Id == refreshTokenExisting.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(rt => rt.ReplacedByTokenId, newRefreshTokenEntity.Id), token);

                return BuildAuthResponse(user, plaintextNewRefreshToken, newRefreshTokenEntity.ExpiresAt, now);
            }, ct);
        }

        // --------------------------------------------------------------------
        // 🔹 LOGOUT — revoke đúng refresh token của phiên hiện tại (thiết bị khác không bị ảnh hưởng)
        // --------------------------------------------------------------------
        public async Task LogoutAsync(string refreshToken, string ip, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;

            var hashedToken = JwtTokenHelper.HashToken(refreshToken);
            var refreshTokenExisting = await _unitOfWork.Repository<RefreshToken>().QueryForEdit()
                .FirstOrDefaultAsync(rt => rt.TokenHash == hashedToken, ct);

            // Token không tồn tại hoặc đã bị revoke → không làm gì cả (idempotent)
            if (refreshTokenExisting is null || refreshTokenExisting.RevokedAt is not null)
            {
                return;
            }

            refreshTokenExisting.RevokedAt = UtcNow();
            refreshTokenExisting.RevokedByIp = ip;
            refreshTokenExisting.ReasonRevoked = "Người dùng logout";
            await _unitOfWork.SaveChangesAsync(ct);
        }

        // --------------------------------------------------------------------
        // 🔹 LOGOUT ALL — thu hồi toàn bộ refresh token đang hoạt động của user (mọi thiết bị)
        // --------------------------------------------------------------------
        public async Task LogoutAllAsync(int userId, string ip, CancellationToken ct)
        {
            await _unitOfWork.RevokeActiveRefreshTokensAsync(userId, ip, "Người dùng logout khỏi mọi thiết bị", UtcNow(), ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        // --------------------------------------------------------------------
        // 🔹 CHANGE PASSWORD — người dùng tự đổi mật khẩu, mọi phiên đăng nhập bị thu hồi
        // --------------------------------------------------------------------
        public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request, string ip, CancellationToken ct)
        {
            // Access token vẫn còn hạn sau khi tài khoản bị khoá, nên phải kiểm tra lại IsActive
            var user = await _unitOfWork.Repository<User>().QueryForEdit()
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct)
                ?? throw new UnauthorizedException("Tài khoản không tồn tại hoặc đã bị khoá");

            // Người có access token (ví dụ máy để quên chưa khoá) cũng có thể dò mật khẩu qua đây: tính chung bộ đếm với login
            var now = UtcNow();
            EnsureNotLockedOut(user, now);
            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            {
                await RegisterFailedPasswordAsync(user, now, ct);
                throw new BusinessException("Mật khẩu hiện tại không đúng.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            // Đổi mật khẩu => mọi thiết bị phải đăng nhập lại (phòng trường hợp mật khẩu cũ đã bị lộ)
            await _unitOfWork.RevokeActiveRefreshTokensAsync(user.Id, ip, "Người dùng đổi mật khẩu", now, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        // --------------------------------------------------------------------
        // 🔹 CURRENT USER
        // --------------------------------------------------------------------
        public async Task<CurrentUserResponse?> CurrentUserAsync(int userId, CancellationToken ct)
        {
            // Access token vẫn còn hạn sau khi tài khoản bị khoá, nên phải kiểm tra lại IsActive
            var user = await _unitOfWork.Repository<User>().Query().FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

            if (user is null)
            {
                return null;
            }

            return new CurrentUserResponse
            {
                UserId = user.Id,
                UserName = user.UserName,
                FullName = user.FullName,
                Roles = [user.Role]
            };
        }

        // --------------------------------------------------------------------
        // 🔹 HELPERS
        // --------------------------------------------------------------------
        private DateTime UtcNow() => _timeProvider.GetUtcNow().UtcDateTime;

        // Phản hồi không phụ thuộc mật khẩu gửi lên: trong lúc khoá, thử mật khẩu nào cũng nhận đúng câu này
        private static void EnsureNotLockedOut(User? user, DateTime now)
        {
            if (user?.LockoutEnd is { } lockoutEnd && lockoutEnd > now)
            {
                var minutes = (int)Math.Ceiling((lockoutEnd - now).TotalMinutes);
                throw new AccountLockedException(
                    $"Tài khoản tạm khoá do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau {minutes} phút hoặc liên hệ quản trị viên.");
            }
        }

        // Một lệnh UPDATE duy nhất: nhiều request sai song song vẫn đếm đủ (SQL Server khoá dòng khi cập nhật).
        // ExecuteUpdate không đi qua SaveChangesAsync nên không sinh AuditLog và không đổi UpdatedAt mỗi lần gõ sai.
        // Đủ ngưỡng thì khoá tạm và đếm lại từ 0, để lần khoá sau cũng cần đủ số lần sai.
        private async Task RegisterFailedPasswordAsync(User user, DateTime now, CancellationToken ct)
        {
            var maxAttempts = _lockoutSettings.MaxFailedAttempts;
            DateTime? lockoutEnd = now.AddMinutes(_lockoutSettings.LockoutMinutes);
            var row = _unitOfWork.Repository<User>().QueryForEdit().Where(u => u.Id == user.Id);

            await row.ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LockoutEnd, u => u.FailedLoginCount + 1 >= maxAttempts ? lockoutEnd : u.LockoutEnd)
                .SetProperty(u => u.FailedLoginCount, u => u.FailedLoginCount + 1 >= maxAttempts ? 0 : u.FailedLoginCount + 1), ct);

            if (await row.AnyAsync(u => u.LockoutEnd > now, ct))
            {
                _logger.LogWarning("Tài khoản {UserName} bị khoá tạm {Minutes} phút do nhập sai mật khẩu {Attempts} lần liên tiếp.",
                    user.UserName, _lockoutSettings.LockoutMinutes, maxAttempts);
            }
        }

        private async Task ResetFailedPasswordsAsync(User user, CancellationToken ct)
        {
            if (user.FailedLoginCount == 0 && user.LockoutEnd is null) return;

            await _unitOfWork.Repository<User>().QueryForEdit()
                .Where(u => u.Id == user.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.FailedLoginCount, 0)
                    .SetProperty(u => u.LockoutEnd, (DateTime?)null), ct);
        }

        private AuthResponse BuildAuthResponse(User user, string plaintextRefreshToken, DateTime refreshTokenExpiresAt, DateTime now)
        {
            return new AuthResponse
            {
                AccessToken = _jwtTokenHelper.GenerateAccessToken(user.Id, user.UserName, [user.Role], now),
                AccessTokenExpiresAt = now.AddMinutes(_jwtSettings.ExpiryInMinutes),
                RefreshToken = plaintextRefreshToken, // Controller xoá khỏi body khi dùng cookie
                RefreshTokenExpiresAt = refreshTokenExpiresAt
            };
        }

        private RefreshToken BuildRefreshToken(int userId, string ip, DateTime now, out string plaintextToken)
        {
            plaintextToken = JwtTokenHelper.GenerateRefreshTokenPlaintext();

            return new RefreshToken
            {
                UserId = userId,
                TokenHash = JwtTokenHelper.HashToken(plaintextToken), // Lưu Hash của Refresh Token vào DB
                ExpiresAt = now.AddDays(_refreshTokenSettings.ExpiryDays),
                CreatedAt = now,
                CreatedByIp = ip
            };
        }
    }
}
