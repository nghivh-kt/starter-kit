using API.Models.Entities;
using API.Common.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Linq.Expressions;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace API.Data
{
    public class EFDbContext : DbContext
    {
        private readonly IUserContext _userContext;
        private readonly TimeProvider _timeProvider;
        public EFDbContext(DbContextOptions<EFDbContext> options, IUserContext userContext, TimeProvider timeProvider) : base(options)
        {
            _userContext = userContext;
            _timeProvider = timeProvider;
        }

        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Category> Categories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Nạp mọi class IEntityTypeConfiguration trong Data/Configurations
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(EFDbContext).Assembly);

            // Soft delete toàn cục: mọi entity kế thừa AuditableEntity tự động bị loại khi DeletedAt != null.
            // Cần xem cả bản ghi đã xoá (báo cáo, khôi phục) thì dùng .IgnoreQueryFilters().
            foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                         .Where(t => typeof(AuditableEntity).IsAssignableFrom(t.ClrType) && t.BaseType == null))
            {
                var parameter = Expression.Parameter(entityType.ClrType, "e");
                var notDeleted = Expression.Equal(
                    Expression.Property(parameter, nameof(AuditableEntity.DeletedAt)),
                    Expression.Constant(null, typeof(DateTime?)));

                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(Expression.Lambda(notDeleted, parameter));
            }
        }

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            // SQL Server không lưu DateTimeKind: giá trị đọc lên có Kind = Unspecified và được serialize thiếu hậu tố "Z",
            // client sẽ hiểu nhầm thành giờ địa phương. Toàn hệ thống lưu UTC nên đánh dấu lại Kind = Utc khi đọc.
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
        }

        private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
            v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        private sealed class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
            v => v, v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);


        // =====================================================================
        // CẤU HÌNH GHI AUDIT LOG TỰ ĐỘNG
        // =====================================================================

        // 1. Các cột nhạy cảm: Chỉ lưu tên cột thay đổi, KHÔNG lưu giá trị (Tránh lộ thông tin)
        private static readonly HashSet<string> SensitiveProperties =
            new(StringComparer.OrdinalIgnoreCase) { "PasswordHash" };

        // 2. Các cột kỹ thuật: Bỏ qua không tính là thay đổi (Tránh sinh log rác liên tục)
        private static readonly HashSet<string> NoiseProperties =
            new(StringComparer.OrdinalIgnoreCase) { "UpdatedAt" };

        // 3. Cấu hình JSON: Giữ nguyên tiếng Việt có dấu, không bị mã hóa thành \uXXXX
        private static readonly JsonSerializerOptions AuditJsonOptions = new()
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        // Ghi đè phương thức SaveChangesAsync để tự động bắt sự kiện Thêm/Sửa/Xóa
        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            // Tự gán CreatedAt/UpdatedAt và đổi lệnh xoá thành xoá mềm (service không cần tự làm)
            // Một mốc thời gian chung cho cả lần lưu: CreatedAt/UpdatedAt/DeletedAt và ChangedAt của AuditLog khớp nhau
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var softDeletedEntities = ApplyAuditableRules(now);

            // Lấy danh sách các entity kế thừa từ AuditableEntity có trạng thái thay đổi
            var auditableEntries = ChangeTracker.Entries()
                .Where(e => e.Entity is AuditableEntity &&
                            (e.State == EntityState.Added ||
                             e.State == EntityState.Modified))
                .ToList();

            if (auditableEntries.Count == 0)
                return await base.SaveChangesAsync(true, cancellationToken);

            // Đảm bảo tính toàn vẹn: Dữ liệu chính và Log phải cùng thành công hoặc cùng thất bại.
            // Nếu bật EnableRetryOnFailure, nhánh dưới bị bỏ qua (strategy không cho tự mở transaction) => mất tính nguyên tử.
            // Xem ghi chú trong Startup/DatabaseConfiguration.cs trước khi bật retry.
            IDbContextTransaction? ownTransaction = null;
            if (Database.CurrentTransaction is null && !Database.CreateExecutionStrategy().RetriesOnFailure)
            {
                ownTransaction = await Database.BeginTransactionAsync(cancellationToken);
            }

            try
            {
                var userId = _userContext.UserId;
                var userName = _userContext.UserName;
                var ip = _userContext.IpAddress;

                // Hàm tạo sẵn khung thông tin cơ bản cho Log
                AuditLog NewLog(EntityEntry entry, AuditActionType action) => new()
                {
                    TableName = entry.Metadata.GetTableName() ?? entry.Metadata.ClrType.Name,
                    ActionType = action,
                    ChangedByUserId = userId,
                    ChangedByUserName = userName,
                    IpAddress = string.IsNullOrEmpty(ip) ? null : ip,
                    ChangedAt = now
                };

                var readyLogs = new List<AuditLog>();
                var pendingAddedLogs = new List<(AuditLog Log, EntityEntry Entry)>(); // Dành cho trường hợp Tạo mới (chờ có ID thật)

                foreach (var entry in auditableEntries)
                {
                    switch (entry.State)
                    {
                        // THÊM MỚI
                        case EntityState.Added:
                            pendingAddedLogs.Add((NewLog(entry, AuditActionType.Created), entry));
                            break;

                        // CẬP NHẬT
                        case EntityState.Modified:
                            {
                                // So sánh OriginalValues (giá trị lúc EF nạp entity từ DB) với CurrentValues:
                                // không tốn thêm truy vấn DB cho mỗi entity như GetDatabaseValuesAsync.
                                //
                                // Ngoại lệ: entity gắn vào bằng Repository.Update() (không nạp từ DB) -> EF không biết giá trị cũ,
                                // mọi cột đều bị đánh dấu sửa và Original == Current. Khi đó ghi toàn bộ giá trị mới, OldValues = null.
                                var isBlindUpdate = entry.Properties.All(p => p.IsModified || p.Metadata.IsPrimaryKey());

                                var oldValues = new Dictionary<string, object?>();
                                var newValues = new Dictionary<string, object?>();
                                var changedColumns = new List<string>();

                                foreach (var p in entry.Properties)
                                {
                                    var name = p.Metadata.Name;
                                    if (NoiseProperties.Contains(name) || p.Metadata.IsPrimaryKey()) continue;

                                    var original = p.OriginalValue;
                                    var current = p.CurrentValue;

                                    // Giá trị cũ và mới giống nhau -> Bỏ qua (Update mù: lấy mọi cột được đánh dấu sửa)
                                    if (isBlindUpdate ? !p.IsModified : object.Equals(original, current)) continue;

                                    changedColumns.Add(name);

                                    // Nếu là cột nhạy cảm thì chỉ ghi nhận tên cột, bỏ qua giá trị
                                    if (SensitiveProperties.Contains(name)) continue;

                                    if (!isBlindUpdate) oldValues[name] = original;
                                    newValues[name] = current;
                                }

                                // Không có thay đổi nào thực tế -> Bỏ qua không ghi log
                                if (changedColumns.Count == 0) break;

                                // Xoá mềm vẫn là UPDATE dưới DB nhưng ghi log là Deleted cho đúng ý nghĩa
                                var action = softDeletedEntities.Contains(entry.Entity) ? AuditActionType.Deleted : AuditActionType.Updated;

                                var log = NewLog(entry, action);
                                log.RecordId = GetPrimaryKeyValue(entry);
                                log.OldValues = isBlindUpdate ? null : Serialize(oldValues);
                                log.NewValues = Serialize(newValues);
                                log.ChangedColumns = Serialize(changedColumns);
                                readyLogs.Add(log);
                                break;
                            }
                    }
                }

                if (readyLogs.Count == 0 && pendingAddedLogs.Count == 0)
                {
                    // Mọi entity Modified đều không có thay đổi thật -> chỉ lưu bình thường
                    var plainResult = await base.SaveChangesAsync(true, cancellationToken);
                    if (ownTransaction is not null) await ownTransaction.CommitAsync(cancellationToken);
                    return plainResult;
                }

                // BƯỚC 1: Lưu dữ liệu nghiệp vụ chính vào Database trước
                var result = await base.SaveChangesAsync(true, cancellationToken);

                // BƯỚC 2: Sau khi tạo mới thành công, bản ghi sẽ có ID thật -> Bổ sung vào log
                foreach (var (log, entry) in pendingAddedLogs)
                {
                    log.RecordId = GetPrimaryKeyValue(entry);

                    var newValues = new Dictionary<string, object?>();
                    foreach (var p in entry.Properties)
                    {
                        if (SensitiveProperties.Contains(p.Metadata.Name)) continue;
                        newValues[p.Metadata.Name] = p.CurrentValue;
                    }
                    log.NewValues = Serialize(newValues);
                    readyLogs.Add(log);
                }

                // BƯỚC 3: Lưu toàn bộ danh sách AuditLog vào bảng log (chung một Transaction)
                AuditLogs.AddRange(readyLogs);
                await base.SaveChangesAsync(true, cancellationToken);

                if (ownTransaction is not null) await ownTransaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                // Không truyền cancellationToken: request đã huỷ thì RollbackAsync sẽ ném lỗi khác, che mất lỗi gốc
                if (ownTransaction is not null) await ownTransaction.RollbackAsync(CancellationToken.None);
                throw;
            }
            finally
            {
                if (ownTransaction is not null) await ownTransaction.DisposeAsync();
            }
        }

        // Chặn lưu đồng bộ để bắt buộc mọi luồng phải dùng SaveChangesAsync (đảm bảo luôn có AuditLog)
        public override int SaveChanges(bool acceptAllChangesOnSuccess) =>
            throw new NotSupportedException("Vui lòng sử dụng SaveChangesAsync để hệ thống ghi nhận AuditLog.");

        /// <summary>
        /// Quy tắc chung cho AuditableEntity:
        /// - Thêm mới: CreatedAt = now
        /// - Sửa: UpdatedAt = now
        /// - Xoá (Repository.Delete): chuyển thành xoá mềm IsActive = false, DeletedAt = now.
        ///   Muốn xoá thật thì dùng ExecuteDeleteAsync.
        /// Trả về danh sách entity vừa bị xoá mềm để AuditLog ghi đúng loại Deleted.
        /// </summary>
        private HashSet<object> ApplyAuditableRules(DateTime now)
        {
            var softDeleted = new HashSet<object>(ReferenceEqualityComparer.Instance);

            foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
            {
                switch (entry.State)
                {
                    case EntityState.Added:
                        entry.Entity.CreatedAt = now;
                        break;

                    case EntityState.Modified:
                        entry.Entity.UpdatedAt = now;
                        break;

                    case EntityState.Deleted:
                        // Không dùng entry.State = Modified: lệnh đó đánh dấu MỌI cột là đã sửa (UPDATE ghi đè cả bảng ghi,
                        // AuditLog hiểu nhầm là Update mù). Về Unchanged rồi gán qua entry.Property -> chỉ 3 cột này bị đánh dấu.
                        entry.State = EntityState.Unchanged;
                        entry.Property(e => e.IsActive).CurrentValue = false;
                        entry.Property(e => e.DeletedAt).CurrentValue = now;
                        entry.Property(e => e.UpdatedAt).CurrentValue = now;
                        softDeleted.Add(entry.Entity);
                        break;
                }
            }

            return softDeleted;
        }

        private static string GetPrimaryKeyValue(EntityEntry entry)
        {
            var key = entry.Metadata.FindPrimaryKey();
            if (key is null) return string.Empty;
            return string.Join(",", key.Properties.Select(p => entry.Property(p.Name).CurrentValue?.ToString()));
        }

        private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, AuditJsonOptions);
    }
}
