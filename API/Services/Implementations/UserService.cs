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

        // Cột trong file Excel. Lấy từ DTO, không từ entity: PasswordHash không thể lọt vào file
        private static readonly ExcelColumn<UserResponse>[] ExportColumns =
        [
            new("Tên đăng nhập", x => x.UserName),
            new("Họ và tên", x => x.FullName),
            new("Email", x => x.Email),
            new("Vai trò", x => x.Role == Roles.Admin ? "Quản trị" : "Người dùng"),
            new("Trạng thái", x => x.IsActive ? "Hoạt động" : "Đã khoá"),
            new("Ngày tạo", x => x.CreatedAt),
        ];

        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;
        private readonly IUserContext _userContext;
        private readonly TimeProvider _timeProvider;
        private readonly IExcelExporter _excel;

        public UserService(IUnitOfWork unitOfWork, IMapper mapper, IUserContext userContext, TimeProvider timeProvider, IExcelExporter excel)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _userContext = userContext;
            _timeProvider = timeProvider;
            _excel = excel;
        }

        public async Task<PagedResult<UserResponse>> GetPagedAsync(UserQueryRequest query, CancellationToken ct)
        {
            var (items, total) = await BuildListQuery(query).ToPagedListAsync(query.Page, query.PageSize, ct);

            return new PagedResult<UserResponse>(_mapper.Map<List<UserResponse>>(items), total, query.Page, query.PageSize);
        }

        public async Task<byte[]> ExportAsync(UserQueryRequest query, CancellationToken ct)
        {
            var source = BuildListQuery(query);
            _excel.EnsureWithinLimit(await source.CountAsync(ct));

            var rows = _mapper.Map<List<UserResponse>>(await source.ToListAsync(ct));
            return _excel.Create("Người dùng", ExportColumns, rows);
        }

        // Danh sách trên màn hình và file Excel dùng chung bộ lọc, nên luôn cho cùng một kết quả
        private IQueryable<User> BuildListQuery(UserQueryRequest query)
        {
            return _unitOfWork.Repository<User>().Query()
                .ApplySearch(query.Search, x => x.UserName, x => x.FullName, x => x.Email)
                .WhereIf(query.IsActive.HasValue, x => x.IsActive == query.IsActive)
                .WhereIf(!string.IsNullOrEmpty(query.Role), x => x.Role == query.Role)
                .ApplySorting(query.SortBy, query.Desc, SortColumns);
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

            // Admin đang sửa trên dữ liệu cũ. Trường hợp người khác lưu ngay sau dòng này thì EF phát hiện lúc UPDATE
            // và GlobalExceptionHandler cũng trả 409.
            if (!existingUser.RowVersion.SequenceEqual(request.RowVersion))
                throw new ConflictException("Người dùng đã được người khác cập nhật. Vui lòng tải lại rồi thử lại.");

            // IsActive không gửi (null) => giữ nguyên, tránh việc client thiếu field vô tình khoá tài khoản
            var newIsActive = request.IsActive ?? existingUser.IsActive;
            var isBeingDeactivated = existingUser.IsActive && !newIsActive;

            // Không cho Admin tự khoá hoặc tự đổi vai trò của chính mình (sẽ tự mất quyền quản trị).
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
                await _unitOfWork.RevokeActiveRefreshTokensAsync(existingUser.Id, _userContext.IpAddress, "Tài khoản bị khoá", _timeProvider.GetUtcNow().UtcDateTime, ct);
            }

            await _unitOfWork.SaveChangesAsync(ct);

            // Trả bản ghi sau khi sửa (giống Category): client cập nhật lại dòng mà không cần gọi GET
            return _mapper.Map<UserResponse>(existingUser);
        }

        public async Task ResetPasswordAsync(int id, UserResetPasswordRequest request, CancellationToken ct)
        {
            var existingUser = await FindTrackedAsync(id, ct);

            existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            // Mật khẩu mới do admin đặt: người dùng đăng nhập được ngay, kể cả khi đang bị khoá tạm
            existingUser.FailedLoginCount = 0;
            existingUser.LockoutEnd = null;

            // Thu hồi toàn bộ refresh token của user đó.
            await _unitOfWork.RevokeActiveRefreshTokensAsync(existingUser.Id, _userContext.IpAddress, "Mật khẩu được đặt lại", _timeProvider.GetUtcNow().UtcDateTime, ct);
            await _unitOfWork.SaveChangesAsync(ct);
        }

        public async Task UnlockAsync(int id, CancellationToken ct)
        {
            var existingUser = await FindTrackedAsync(id, ct);

            existingUser.FailedLoginCount = 0;
            existingUser.LockoutEnd = null;

            // Đang bị khoá thì AuditLog ghi lại admin nào đã mở khoá; không bị khoá thì không có gì thay đổi
            await _unitOfWork.SaveChangesAsync(ct);
        }

        private async Task<User> FindTrackedAsync(int id, CancellationToken ct)
        {
            return await _unitOfWork.Repository<User>()
                .QueryForEdit()
                .FirstOrDefaultAsync(u => u.Id == id, ct)
                ?? throw new NotFoundException($"Không tìm thấy User có Id = {id}.");
        }
    }
}
