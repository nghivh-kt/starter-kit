using System.Data;

namespace API.Data.Interfaces
{
    /// <summary>
    /// Interface chuẩn cho Repository Dapper – hỗ trợ Stored Procedure, SQL text, và DataTable.
    /// </summary>
    public interface IDapperRepository
    {
        /// <summary>
        /// Thực thi Stored Procedure và map kết quả sang List<T>.
        /// </summary>
        Task<IEnumerable<T>> ExecStoredProcAsync<T>(string procedureName, object? parameters = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi SQL text (SELECT / UPDATE / DELETE) và map kết quả sang List<T>.
        /// </summary>
        Task<IEnumerable<T>> QueryAsync<T>(string sql, object? parameters = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi Stored Procedure và trả về DataTable (thường dùng cho report / export).
        /// </summary>
        Task<DataTable> ExecStoredProcToDataTableAsync(string procedureName, object? parameters = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi non-query SP (INSERT/UPDATE/DELETE) và trả về số dòng bị ảnh hưởng.
        /// </summary>
        Task<int> ExecNonQueryAsync(string procedureName, object? parameters = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thực thi SQL text không trả dữ liệu (INSERT/UPDATE/DELETE) và trả về số dòng bị ảnh hưởng.
        /// Lệnh ghi qua Dapper không đi qua EFDbContext nên không có AuditLog và không tự gán CreatedAt/UpdatedAt.
        /// </summary>
        Task<int> ExecuteAsync(string sql, object? parameters = null, CancellationToken cancellationToken = default);
    }
}
