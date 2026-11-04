using API.Common.Exceptions;
using API.Common.Helpers;
using API.Common.Security;
using API.Data.Extensions;
using API.Data.Interfaces;
using API.Models.DTOs;
using API.Models.Entities;
using API.Services.Interfaces;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace API.Services.Implementations
{
    public class UserService : IUserService
    {
        // Chỉ cho phép sắp xếp theo các cột này (client gửi tên cột tuỳ ý sẽ gây lỗi SQL)
        private static readonly Dictionary<string, string> SortColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            ["id"] = nameof(User.Id),
            ["userName"] = nameof(User.UserName),
            ["fullName"] = nameof(User.FullName),
            ["email"] = nameof(User.Email),
            ["createdAt"] = nameof(User.CreatedAt),
        };

        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;
        private readonly IUserContext _userContext;
        private readonly TimeProvider _timeProvider;

        public UserService(IUnitOfWork unitOfWork, IMapper mapper, IUserContext userContext, TimeProvider timeProvider)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _userContext = userContext;
            _timeProvider = timeProvider;
        }

        public async Task<PagedResult<UserResponse>> GetPagedAsync(UserQueryRequest query, CancellationToken ct)
        {
            var source = _unitOfWork.Repository<User>().Query(asNoTracking: true)
                .ApplySearch(query.Search, x => x.UserName, x => x.FullName, x => x.Email)
                .ApplyEquals(x => x.IsActive, query.IsActive)
                .ApplyEquals(x => x.Role, query.Role);

            // Chỉ cho phép sắp xếp theo các cột trong whitelist, mặc định Id
            var sortBy = query.SortBy != null && SortColumns.TryGetValue(query.SortBy, out var column) ? column : nameof(User.Id);
            source = source.ApplySorting(sortBy, query.Desc);

            var (items, total) = await source.ToPagedListAsync(query.Page, query.PageSize, ct);

            return new PagedResult<UserResponse>(_mapper.Map<List<UserResponse>>(items), total, query.Page, query.PageSize);
        }

        public async Task<UserResponse> GetUserByIdAsync(int id, CancellationToken ct)
        {
            var user = await _unitOfWork.Repository<User>().Query().FirstOrDefaultAsync(u => u.Id == id, ct)
                ?? throw new NotFoundException($"Không tìm thấy User có Id = {id}.");
            return _mapper.Map<UserResponse>(user);
        }

        public async Task<UserResponse> CreateAsync(UserCreateRequest request, CancellationToken ct)
        {
            // Nơi DUY NHẤT kiểm tra trùng (validator chỉ kiểm tra định dạng, không truy vấn DB).
            // Tính cả user đã xoá mềm: unique index UserName/Email tính cả các bản ghi đó.
            // Không IgnoreQueryFilters thì tạo lại username của user đã xoá sẽ vấp lỗi SQL (409) thay vì thông báo rõ ràng.
            var users = _unitOfWork.Repository<User>().Query().IgnoreQueryFilters();
            if (await users.AnyAsync(u => u.UserName == request.UserName, ct))
            {
                throw new BusinessException("Tên đăng nhập này đã tồn tại.");
            }
            if (await users.AnyAsync(u => u.Email == request.Email, ct))
            {
                throw new BusinessException("Email này đã được sử dụng.");
            }

            var user = _mapper.Map<User>(request);
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.IsActive = true;

            await _unitOfWork.Repository<User>().AddAsync(user, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return _mapper.Map<UserResponse>(user);
        }

        public async Task<UserResponse> UpdateAsync(int id, UserUpdateRequest request, CancellationToken ct)
        {
            // Tracking: EF chỉ UPDATE các cột thay đổi; UpdatedAt do EFDbContext tự gán
            var existingUser = await FindTrackedAsync(id, ct);

            // IsActive không gửi (null) => giữ nguyên, tránh việc client thiếu field vô tình khoá tài khoản
            var newIsActive = request.IsActive ?? existingUser.IsActive;
            var isBeingDeactivated = existingUser.IsActive && !newIsActive;

            // Không cho Admin tự khoá hoặc tự đổi vai trò của chính mình (sẽ tự mất quyền quản trị).
            // UserId là null với token cấp trước khi có claim "uid" — khi đó quy tắc này chưa áp dụng.
            if (_userContext.UserId == existingUser.Id && (isBeingDeactivated || request.Role != existingUser.Role))
            {
                throw new BusinessException("Bạn không thể tự khoá hoặc tự đổi vai trò của chính mình.");
            }

            // Không dùng Mapper, chỉ cập nhật các trường được phép sửa (Role bắt buộc, đã kiểm tra trong validator)
            existingUser.FullName = request.FullName;
            existingUser.Role = request.Role;
            existingUser.IsActive = newIsActive;

            // Khoá tài khoản => thu hồi toàn bộ refresh token của user đó.
            // Nếu không, khi mở khoá lại, các token cũ sẽ sống lại.
            if (isBeingDeactivated)
            {
                await _unitOfWork.RevokeActiveRefreshTokensAsync(existingUser.Id, _userContext.IpAddress, "Tài khoản bị khóa", _timeProvider.GetUtcNow().UtcDateTime, ct);
            }

            await _unitOfWork.SaveChangesAsync(ct);

            // Trả bản ghi sau khi sửa (giống Category): client cập nhật lại dòng mà không cần gọi GET
            return _mapper.Map<UserResponse>(existingUser);
        }

        public async Task ResetPasswordAsync(int id, UserResetPasswordRequest request, CancellationToken ct)
        {
            var existingUser = await FindTrackedAsync(id, ct);

            existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            // Thu hồi toàn bộ refresh token của user đó.
            await _unitOfWork.RevokeActiveRefreshTokensAsync(existingUser.Id, _userContext.IpAddress, "Mật khẩu được đặt lại", _timeProvider.GetUtcNow().UtcDateTime, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        private async Task<User> FindTrackedAsync(int id, CancellationToken ct)
        {
            return await _unitOfWork.Repository<User>()
                .Query(asNoTracking: false)
                .FirstOrDefaultAsync(u => u.Id == id, ct)
                ?? throw new NotFoundException($"Không tìm thấy User có Id = {id}.");
        }
    }
}
