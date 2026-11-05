using API.Common.Helpers;
using API.Models.DTOs;

namespace API.Services.Interfaces
{
    public interface ICategoryService
    {
        Task<PagedResult<CategoryResponse>> GetPagedAsync(CategoryQueryRequest query, CancellationToken ct);
        /// <summary>File Excel chứa mọi dòng khớp bộ lọc, không phân trang.</summary>
        Task<byte[]> ExportAsync(CategoryQueryRequest query, CancellationToken ct);
        Task<CategoryResponse> GetByIdAsync(int id, CancellationToken ct);
        Task<CategoryResponse> CreateAsync(CategoryCreateRequest request, CancellationToken ct);
        Task<CategoryResponse> UpdateAsync(int id, CategoryUpdateRequest request, CancellationToken ct);
        Task DeleteAsync(int id, CancellationToken ct);
    }
}
