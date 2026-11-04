namespace API.Data.Interfaces
{
    /// <summary>
    /// UnitOfWork pattern – quản lý EF Core và Dapper trong cùng 1 scope.
    /// Không implement IDisposable: EFDbContext do DI container tạo và giải phóng cuối request.
    /// </summary>
    public interface IUnitOfWork
    {
        /// <summary>
        /// Lấy GenericRepository cho entity EF.
        /// </summary>
        IGenericRepository<T> Repository<T>() where T : class;

        /// <summary>
        /// Lấy Repository Dapper (dành cho Stored Procedure / Raw SQL).
        /// </summary>
        IDapperRepository Dapper { get; }

        /// <summary>
        /// Lưu thay đổi vào database của EF.
        /// </summary>
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi 1 hành động trong transaction.
        /// Tự động SaveChanges và Commit nếu thành công, Rollback nếu thất bại.
        /// </summary>
        /// <param name="action">Delegate async cần thực thi.</param>
        /// <param name="cancellationToken">Token hủy.</param>
        Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi 1 hành động trong transaction và trả về kết quả.
        /// Tự động SaveChanges và Commit nếu thành công, Rollback nếu thất bại.
        /// </summary>
        /// <typeparam name="TResult">Kiểu dữ liệu trả về.</typeparam>
        /// <param name="action">Delegate async cần thực thi.</param>
        /// <param name="cancellationToken">Token hủy.</param>
        Task<TResult> ExecuteInTransactionAsync<TResult>(Func<CancellationToken, Task<TResult>> action, CancellationToken cancellationToken = default);
    }
}
