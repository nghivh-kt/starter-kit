using System.Linq.Expressions;

namespace API.Data.Interfaces
{
    public interface IGenericRepository<T> where T : class
    {
        /// <summary>
        /// Tạo câu lệnh truy vấn (LINQ). Mặc định bật AsNoTracking để tối ưu hiệu năng đọc.
        /// </summary>
        IQueryable<T> Query(bool asNoTracking = true);

        /// <summary>
        /// Tìm kiếm một bản ghi dựa trên khóa chính (Primary Key).
        /// </summary>
        Task<T?> GetByIdAsync(object key, CancellationToken cancellationToken = default);

        /// <summary>
        /// Tìm kiếm một bản ghi dựa trên danh sách các khóa chính (Primary Keys).
        /// </summary>
        Task<T?> GetByIdAsync(object[] keys, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thêm mới một bản ghi vào Database.
        /// </summary>
        Task AddAsync(T entity, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thêm mới danh sách nhiều bản ghi cùng lúc.
        /// </summary>
        Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);

        /// <summary>
        /// Đánh dấu một bản ghi là đã thay đổi để cập nhật (Update).
        /// </summary>
        void Update(T entity);

        /// <summary>
        /// Đánh dấu danh sách nhiều bản ghi là đã thay đổi để cập nhật hàng loạt.
        /// </summary>
        void UpdateRange(IEnumerable<T> entities);

        /// <summary>
        /// Đánh dấu một bản ghi để xóa (Delete).
        /// </summary>
        void Delete(T entity);

        /// <summary>
        /// Đánh dấu danh sách nhiều bản ghi để xóa hàng loạt.
        /// </summary>
        void DeleteRange(IEnumerable<T> entities);

        /// <summary>
        /// Kiểm tra xem có bản ghi nào khớp với điều kiện (predicate) hay không.
        /// </summary>
        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    }
}
