using API.Common.Exceptions;
using API.Common.Helpers;
using API.Data.Extensions;
using API.Data.Interfaces;
using API.Models.DTOs;
using API.Models.Entities;
using API.Services.Interfaces;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace API.Services.Implementations
{
    /// <summary>
    /// Module CRUD mẫu. Khi tạo module mới, copy Category (Entity, DTO, Validator, Service, Controller)
    /// rồi đổi tên và thêm field.
    /// </summary>
    public class CategoryService : ICategoryService
    {
        // Chỉ cho phép sắp xếp theo các cột này (client gửi tên cột tuỳ ý sẽ gây lỗi SQL)
        private static readonly Dictionary<string, string> SortColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            ["id"] = nameof(Category.Id),
            ["name"] = nameof(Category.Name),
            ["createdAt"] = nameof(Category.CreatedAt),
        };

        // Cột trong file Excel. Lấy từ DTO, không từ entity: field mới của entity không tự lộ ra file
        private static readonly ExcelColumn<CategoryResponse>[] ExportColumns =
        [
            new("Tên danh mục", x => x.Name),
            new("Diễn giải", x => x.Description),
            new("Trạng thái", x => x.IsActive ? "Hoạt động" : "Tạm ngưng"),
            new("Ngày tạo", x => x.CreatedAt),
        ];

        private readonly IUnitOfWork _unitOfWork;
        private readonly IMapper _mapper;
        private readonly IExcelExporter _excel;

        public CategoryService(IUnitOfWork unitOfWork, IMapper mapper, IExcelExporter excel)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _excel = excel;
        }

        public async Task<PagedResult<CategoryResponse>> GetPagedAsync(CategoryQueryRequest query, CancellationToken ct)
        {
            var (items, total) = await BuildListQuery(query).ToPagedListAsync(query.Page, query.PageSize, ct);

            return new PagedResult<CategoryResponse>(
                _mapper.Map<List<CategoryResponse>>(items), total, query.Page, query.PageSize);
        }

        public async Task<byte[]> ExportAsync(CategoryQueryRequest query, CancellationToken ct)
        {
            var source = BuildListQuery(query);
            _excel.EnsureWithinLimit(await source.CountAsync(ct));

            var rows = _mapper.Map<List<CategoryResponse>>(await source.ToListAsync(ct));
            return _excel.Create("Danh mục", ExportColumns, rows);
        }

        // Danh sách trên màn hình và file Excel dùng chung bộ lọc, nên luôn cho cùng một kết quả
        private IQueryable<Category> BuildListQuery(CategoryQueryRequest query)
        {
            // 1. Bản ghi đã xoá mềm tự động bị loại nhờ global query filter (EFDbContext)
            var source = _unitOfWork.Repository<Category>().Query(asNoTracking: true);

            // 2. Tìm kiếm + lọc (mỗi hàm tự bỏ qua khi tham số null)
            source = source
                .ApplySearch(query.Search, x => x.Name, x => x.Description)
                .ApplyEquals(x => x.IsActive, query.IsActive);

            // 3. Sắp xếp theo whitelist, mặc định Id
            var sortBy = query.SortBy != null && SortColumns.TryGetValue(query.SortBy, out var column) ? column : nameof(Category.Id);
            return source.ApplySorting(sortBy, query.Desc);
        }

        public async Task<CategoryResponse> GetByIdAsync(int id, CancellationToken ct)
        {
            var category = await _unitOfWork.Repository<Category>()
                .Query(asNoTracking: true)
                .FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException($"Không tìm thấy danh mục có Id = {id}.");

            return _mapper.Map<CategoryResponse>(category);
        }

        public async Task<CategoryResponse> CreateAsync(CategoryCreateRequest request, CancellationToken ct)
        {
            await EnsureNameIsUniqueAsync(request.Name, excludeId: null, ct);

            var category = _mapper.Map<Category>(request);

            await _unitOfWork.Repository<Category>().AddAsync(category, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return _mapper.Map<CategoryResponse>(category);
        }

        public async Task<CategoryResponse> UpdateAsync(int id, CategoryUpdateRequest request, CancellationToken ct)
        {
            // Lấy entity có tracking: EF chỉ UPDATE những cột thực sự thay đổi, không cần gọi Repository.Update().
            // UpdatedAt do EFDbContext tự gán
            var category = await FindTrackedAsync(id, ct);

            // Client đang sửa trên dữ liệu cũ. Trường hợp người khác lưu ngay sau dòng này thì EF phát hiện lúc UPDATE
            // và GlobalExceptionHandler cũng trả 409.
            if (!category.RowVersion.SequenceEqual(request.RowVersion))
                throw new ConflictException("Danh mục đã được người khác cập nhật. Vui lòng tải lại rồi thử lại.");

            await EnsureNameIsUniqueAsync(request.Name, excludeId: id, ct);

            // Gán tay từng trường được phép sửa (không dùng Mapper): rõ ràng, không lỡ ghi đè cột ngoài ý muốn
            category.Name = request.Name;
            category.Description = request.Description;
            category.IsActive = request.IsActive ?? category.IsActive;

            await _unitOfWork.SaveChangesAsync(ct);

            return _mapper.Map<CategoryResponse>(category);
        }

        public async Task DeleteAsync(int id, CancellationToken ct)
        {
            var category = await FindTrackedAsync(id, ct);

            // EFDbContext tự chuyển thành xoá mềm (IsActive = false, DeletedAt = now) và ghi AuditLog loại Deleted
            _unitOfWork.Repository<Category>().Delete(category);

            await _unitOfWork.SaveChangesAsync(ct);
        }

        private async Task<Category> FindTrackedAsync(int id, CancellationToken ct)
        {
            return await _unitOfWork.Repository<Category>()
                .Query(asNoTracking: false)
                .FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NotFoundException($"Không tìm thấy danh mục có Id = {id}.");
        }

        private async Task EnsureNameIsUniqueAsync(string name, int? excludeId, CancellationToken ct)
        {
            var exists = await _unitOfWork.Repository<Category>()
                .ExistsAsync(c => c.Name == name && c.Id != excludeId, ct);

            if (exists)
                throw new BusinessException($"Danh mục '{name}' đã tồn tại.");
        }
    }
}
