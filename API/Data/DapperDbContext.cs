using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;

namespace API.Data
{
    /// <summary>
    /// Quản lý việc chia sẻ kết nối và transaction giữa EF Core và Dapper.
    /// Không tự khởi tạo Connection mới mà dùng chung từ EFDbContext.
    /// </summary>
    public class DapperDbContext
    {
        private readonly EFDbContext _efDbContext;

        public DapperDbContext(EFDbContext efDbContext)
        {
            _efDbContext = efDbContext ?? throw new ArgumentNullException(nameof(efDbContext));
        }

        /// <summary>
        /// Trả về connection hiện tại của EF Core. 
        /// EF Core sẽ tự động quản lý việc Open/Close dựa trên DbContext LifeCycle.
        /// </summary>
        public IDbConnection Connection => _efDbContext.Database.GetDbConnection();

        /// <summary>
        /// Trả về Transaction hiện tại của EF Core (nếu có).
        /// Trả về null nếu không có transaction nào đang hoạt động.
        /// </summary>
        public IDbTransaction? Transaction => _efDbContext.Database.CurrentTransaction?.GetDbTransaction();

        /* * LƯU Ý CHO BỘ CORE:
         * 1. Không cần triển khai IDisposable: Vì EFDbContext đã quản lý vòng đời Connection. 
         * Khi EFDbContext dispose (cuối request), Connection sẽ tự đóng.
         * 2. Không cần BeginTransaction/Commit/Rollback thủ công: 
         * Các hàm này nên được điều khiển tập trung tại UnitOfWork thông qua EF Core 
         * để đảm bảo tính nhất quán cho toàn bộ dự án.
         */
    }
}
