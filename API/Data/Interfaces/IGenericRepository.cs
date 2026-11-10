using System.Linq.Expressions;

namespace API.Data.Interfaces
{
    /// <summary>
    /// Truy cập một bảng như một bộ sưu tập. Lấy qua IUnitOfWork.Repository&lt;T&gt;(): mọi repository của một request
    /// dùng chung một EFDbContext, nên thay đổi trên nhiều bảng được lưu cùng lúc bằng IUnitOfWork.SaveChangesAsync.
    /// </summary>
    public interface IGenericRepository<T> where T : class
    {
        /// <summary>
        /// Truy vấn để đọc (hiển thị, xuất file, kiểm tra tồn tại). Không tracking: nhanh hơn và tốn ít bộ nhớ hơn,
        /// nhưng sửa entity lấy từ đây rồi SaveChangesAsync sẽ không lưu gì. Muốn sửa hoặc xoá thì dùng QueryForEdit().
        /// </summary>
        IQueryable<T> Query();

        /// <summary>
        /// Truy vấn để ghi: sửa property rồi SaveChangesAsync (EF chỉ UPDATE cột thật sự thay đổi), Delete, hoặc
        /// ExecuteUpdateAsync/ExecuteDeleteAsync. Có tracking để EF ghi nhớ giá trị gốc. Không khoá dòng trong database.
        /// </summary>
        IQueryable<T> QueryForEdit();

        /// <summary>Thêm mới một bản ghi (INSERT khi SaveChangesAsync).</summary>
        Task AddAsync(T entity, CancellationToken cancellationToken = default);

        /// <summary>Thêm mới nhiều bản ghi cùng lúc.</summary>
        Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);

        /// <summary>
        /// Xoá bản ghi lấy từ QueryForEdit(). Entity kế thừa AuditableEntity được EFDbContext đổi thành xoá mềm.
        /// </summary>
        void Delete(T entity);

        /// <summary>Xoá nhiều bản ghi lấy từ QueryForEdit().</summary>
        void DeleteRange(IEnumerable<T> entities);

        /// <summary>Có bản ghi nào khớp điều kiện hay không (SELECT EXISTS, không nạp dữ liệu).</summary>
        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    }
}
