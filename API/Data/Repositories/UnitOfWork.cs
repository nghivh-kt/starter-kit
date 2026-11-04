using API.Data.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace API.Data.Repositories
{
    /// <summary>
    /// UnitOfWork pattern – quản lý EF Core và Dapper trong cùng 1 scope.
    /// </summary>
    public class UnitOfWork : IUnitOfWork
    {
        private readonly EFDbContext _context;
        private readonly IDapperRepository _dapperRepository;
        private readonly ConcurrentDictionary<Type, object> _repositories = new();

        public UnitOfWork(EFDbContext context, IDapperRepository dapperRepository)
        {
            _context = context;
            _dapperRepository = dapperRepository;
        }

        /// <summary>
        /// Lấy GenericRepository cho entity EF.
        /// </summary>
        public IGenericRepository<T> Repository<T>() where T : class
        {
            return (IGenericRepository<T>)_repositories.GetOrAdd(typeof(T), _ => new GenericRepository<T>(_context));
        }

        /// <summary>
        /// Lấy Repository Dapper (dành cho Stored Procedure / Raw SQL).
        /// </summary>
        public IDapperRepository Dapper => _dapperRepository;

        /// <summary>
        /// Lưu thay đổi vào database của EF.
        /// </summary>
        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }

        /// <summary>
        /// Chạy 1 hành động trong transaction của EF (non-return).
        /// </summary>
        public async Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken cancellationToken = default)
        {
            // BƯỚC 1: Khởi tạo chiến lược thực thi (Execution Strategy).
            // Hiện CHƯA bật retry (xem DatabaseConfiguration) nên đoạn code bên trong chỉ chạy 1 lần.
            // Đi qua strategy để khi bật EnableRetryOnFailure, cả transaction được chạy lại từ đầu thay vì báo lỗi.
            var strategy = _context.Database.CreateExecutionStrategy();

            // BƯỚC 2: Thực thi logic trong "vòng bảo vệ" của Strategy.
            await strategy.ExecuteAsync(async () =>
            {
                // BƯỚC 3: Kiểm tra xem đã có một Transaction nào đang mở sẵn chưa.
                // Nếu hàm này được gọi lồng bên trong một hàm khác cũng có Transaction, ta sẽ dùng chung luôn.
                if (_context.Database.CurrentTransaction is not null)
                {
                    await action(cancellationToken);
                    return; // Thoát ra vì Transaction cha sẽ lo việc Commit/Rollback.
                }

                // BƯỚC 4: Bắt đầu một Transaction mới thực thụ dưới Database.
                // "await using" đảm bảo Transaction sẽ luôn được giải phóng (Dispose) sạch sẽ khi xong việc.
                await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);

                try
                {
                    // BƯỚC 5: Thực thi các lệnh nghiệp vụ (Lệnh Dapper hoặc EF Core) truyền vào từ Service.
                    await action(cancellationToken);

                    // BƯỚC 6: Đẩy toàn bộ thay đổi của EF Core xuống Database.
                    // Bước này phải chạy TRƯỚC khi Commit. Nếu Save lỗi, hệ thống sẽ nhảy ngay xuống khối catch.
                    await _context.SaveChangesAsync(cancellationToken);

                    // BƯỚC 7: Xác nhận lưu vĩnh viễn (Commit). 
                    // Đến đây, dữ liệu mới chính thức được ghi vào ổ đĩa Database.
                    await tx.CommitAsync(cancellationToken);
                }
                catch
                {
                    // BƯỚC 8: Nếu có bất kỳ lỗi nào xảy ra trong try, ngay lập tức hủy bỏ mọi thay đổi.
                    // Database sẽ quay về trạng thái ban đầu như chưa có chuyện gì xảy ra.
                    // Không truyền cancellationToken: request đã huỷ thì RollbackAsync sẽ ném lỗi khác, che mất lỗi gốc.
                    await tx.RollbackAsync(CancellationToken.None);

                    // BƯỚC 9: Ném lỗi ra ngoài để tầng Service hoặc Middleware xử lý/hiển thị thông báo.
                    throw;
                }
            });
        }

        /// <summary>
        /// Chạy 1 hành động trong transaction của EF (return value).
        /// </summary>
        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<CancellationToken, Task<TResult>> action, CancellationToken cancellationToken = default)
        {
            var strategy = _context.Database.CreateExecutionStrategy();

            return await strategy.ExecuteAsync(async () =>
            {
                if (_context.Database.CurrentTransaction is not null)
                {
                    return await action(cancellationToken);
                }

                await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    var result = await action(cancellationToken);
                    await _context.SaveChangesAsync(cancellationToken);
                    await tx.CommitAsync(cancellationToken);
                    return result;
                }
                catch
                {
                    await tx.RollbackAsync(CancellationToken.None);
                    throw;
                }
            });
        }
    }
}
