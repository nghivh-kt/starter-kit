using API.Data.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API.Data.Repositories
{
    /// <summary>
    /// Một đơn vị công việc cho mỗi request, xem IUnitOfWork.
    /// </summary>
    public class UnitOfWork : IUnitOfWork
    {
        private readonly EFDbContext _context;
        private readonly IDapperRepository _dapperRepository;
        // Không cần ConcurrentDictionary: UnitOfWork là Scoped và EFDbContext không dùng được từ nhiều luồng cùng lúc
        private readonly Dictionary<Type, object> _repositories = [];

        public UnitOfWork(EFDbContext context, IDapperRepository dapperRepository)
        {
            _context = context;
            _dapperRepository = dapperRepository;
        }

        /// <summary>
        /// Lấy GenericRepository cho entity EF. Mọi repository dùng chung _context, nên cùng nằm trong một đơn vị công việc.
        /// </summary>
        public IGenericRepository<T> Repository<T>() where T : class
        {
            if (!_repositories.TryGetValue(typeof(T), out var repository))
            {
                repository = new GenericRepository<T>(_context);
                _repositories[typeof(T)] = repository;
            }
            return (IGenericRepository<T>)repository;
        }

        /// <summary>
        /// Lấy Repository Dapper (dành cho Stored Procedure / Raw SQL).
        /// </summary>
        public IDapperRepository Dapper => _dapperRepository;

        /// <summary>
        /// Lưu thay đổi vào database của EF.
        /// </summary>
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }

        /// <summary>
        /// Chạy 1 hành động trong transaction của EF (không trả giá trị). Dùng chung logic với bản có giá trị trả về.
        /// </summary>
        public Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken cancellationToken = default)
        {
            return ExecuteInTransactionAsync(async token =>
            {
                await action(token);
                return true;
            }, cancellationToken);
        }

        /// <summary>
        /// Chạy 1 hành động trong transaction của EF (có giá trị trả về).
        /// </summary>
        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<CancellationToken, Task<TResult>> action, CancellationToken cancellationToken = default)
        {
            // BƯỚC 1: Đi qua execution strategy. Hiện CHƯA bật retry (xem DatabaseConfiguration) nên đoạn code bên trong chỉ chạy 1 lần.
            // Khi bật EnableRetryOnFailure, cả transaction được chạy lại từ đầu thay vì báo lỗi.
            var strategy = _context.Database.CreateExecutionStrategy();

            return await strategy.ExecuteAsync(async () =>
            {
                // BƯỚC 2: Đã có transaction đang mở (hàm này được gọi lồng bên trong một transaction khác): dùng chung,
                // transaction cha sẽ lo Commit/Rollback.
                if (_context.Database.CurrentTransaction is not null)
                {
                    return await action(cancellationToken);
                }

                // BƯỚC 3: Mở transaction mới. "await using" đảm bảo transaction luôn được giải phóng khi xong việc.
                await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    // BƯỚC 4: Lệnh nghiệp vụ (EF hoặc Dapper). Dapper tự dùng chung transaction này qua DapperDbContext.
                    var result = await action(cancellationToken);

                    // BƯỚC 5: Đẩy thay đổi của EF xuống database TRƯỚC khi Commit. Lưu lỗi thì nhảy xuống catch.
                    await _context.SaveChangesAsync(cancellationToken);

                    // BƯỚC 6: Xác nhận lưu vĩnh viễn.
                    await tx.CommitAsync(cancellationToken);
                    return result;
                }
                catch
                {
                    // BƯỚC 7: Có lỗi thì huỷ mọi thay đổi, rồi ném lỗi ra để GlobalExceptionHandler trả về cho client.
                    // Không truyền cancellationToken: request đã huỷ thì RollbackAsync sẽ ném lỗi khác, che mất lỗi gốc.
                    await tx.RollbackAsync(CancellationToken.None);
                    throw;
                }
            });
        }
    }
}
