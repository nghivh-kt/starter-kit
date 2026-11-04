using API.Data.Interfaces;
using Dapper;
using System.Data;

namespace API.Data.Repositories
{
    /// <summary>
    /// Repository chuẩn cho Dapper – hỗ trợ Stored Procedure, SQL text, và DataTable.
    /// </summary>
    public class DapperRepository : IDapperRepository
    {
        private readonly DapperDbContext _context;

        public DapperRepository(DapperDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Helper tạo CommandDefinition để tái sử dụng code
        /// </summary>
        private CommandDefinition CreateCommand(string sql, object? parameters, CommandType commandType, CancellationToken cancellationToken)
        {
            return new CommandDefinition(
                commandText: sql,
                parameters: parameters,
                transaction: _context.Transaction,
                commandType: commandType,
                cancellationToken: cancellationToken // ✅ Truyền token vào đây
            );
        }

        /// <summary>
        /// Thực thi Stored Procedure và map kết quả sang List<T>.
        /// </summary>
        public async Task<IEnumerable<T>> ExecStoredProcAsync<T>(
            string procedureName,
            object? parameters = null, CancellationToken cancellationToken = default)
        {
            // ✅ Sử dụng CommandDefinition
            var command = CreateCommand(procedureName, parameters, CommandType.StoredProcedure, cancellationToken);

            return await _context.Connection.QueryAsync<T>(command);
        }

        /// <summary>
        /// Thực thi SQL text (SELECT / UPDATE / DELETE) và map kết quả sang List<T>.
        /// </summary>
        public async Task<IEnumerable<T>> QueryAsync<T>(
            string sql,
            object? parameters = null, CancellationToken cancellationToken = default)
        {
            // ✅ Sử dụng CommandDefinition
            var command = CreateCommand(sql, parameters, CommandType.Text, cancellationToken);

            return await _context.Connection.QueryAsync<T>(command);
        }

        /// <summary>
        /// Thực thi Stored Procedure và trả về DataTable (thường dùng cho report / export).
        /// </summary>
        public async Task<DataTable> ExecStoredProcToDataTableAsync(string procedureName, object? parameters = null, CancellationToken cancellationToken = default)
        {
            // 1. Tận dụng lại CreateCommand -> Tự động nhận Transaction & Token
            var command = CreateCommand(procedureName, parameters, CommandType.StoredProcedure, cancellationToken);

            // 2. Dùng Dapper để lấy IDataReader (Thay vì tự tạo SqlCommand)
            // Dapper sẽ tự lo việc map parameters (kể cả DynamicParameters hay List)
            using var reader = await _context.Connection.ExecuteReaderAsync(command);

            // 3. Load vào DataTable
            var dt = new DataTable();

            // Lưu ý: dt.Load là hàm sync, nhưng việc fetch data từ DB đã được await ở bước ExecuteReaderAsync
            dt.Load(reader);

            return dt;
        }        

        /// <summary>
        /// Thực thi non-query SP (INSERT/UPDATE/DELETE) và trả về số dòng bị ảnh hưởng.
        /// </summary>
        public async Task<int> ExecNonQueryAsync(
            string procedureName,
            object? parameters = null, CancellationToken cancellationToken = default)
        {
            // ✅ Sử dụng CommandDefinition
            var command = CreateCommand(procedureName, parameters, CommandType.StoredProcedure, cancellationToken);

            return await _context.Connection.ExecuteAsync(command);
        }

        /// <summary>
        /// Thực thi SQL text không trả dữ liệu (INSERT/UPDATE/DELETE) và trả về số dòng bị ảnh hưởng.
        /// </summary>
        public async Task<int> ExecuteAsync(
            string sql,
            object? parameters = null, CancellationToken cancellationToken = default)
        {
            var command = CreateCommand(sql, parameters, CommandType.Text, cancellationToken);

            return await _context.Connection.ExecuteAsync(command);
        }
    }
}
