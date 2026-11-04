using Dapper;
using System.Data;

namespace API.Data
{
    /// <summary>
    /// Bản Dapper của value converter trong EFDbContext.ConfigureConventions: toàn hệ thống lưu UTC, nên giá trị đọc
    /// lên được đánh dấu Kind = Utc để JSON có hậu tố "Z". Nullable được Dapper tự xử lý. Đăng ký trong DatabaseConfiguration.
    /// </summary>
    public sealed class UtcDateTimeTypeHandler : SqlMapper.TypeHandler<DateTime>
    {
        public override DateTime Parse(object value) => DateTime.SpecifyKind((DateTime)value, DateTimeKind.Utc);

        public override void SetValue(IDbDataParameter parameter, DateTime value)
        {
            parameter.DbType = DbType.DateTime2;
            parameter.Value = value;
        }
    }
}
