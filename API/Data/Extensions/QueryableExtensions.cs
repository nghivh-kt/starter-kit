using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace API.Data.Extensions
{
    /// <summary>
    /// Tiện ích dựng truy vấn danh sách: lọc, tìm kiếm, sắp xếp, phân trang. Mọi hàm đều dịch được xuống SQL Server.
    /// Dùng chung cho màn hình danh sách và file Excel (xem BuildListQuery trong CategoryService).
    /// </summary>
    public static class QueryableExtensions
    {
        /// <summary>
        /// Chỉ thêm điều kiện khi <paramref name="condition"/> = true, ví dụ khi client có gửi tham số lọc.
        /// Giá trị trong lambda thành tham số SQL (@p0...), không bị nhúng thẳng vào câu lệnh.
        /// </summary>
        /// <example>
        /// query.WhereIf(request.IsActive.HasValue, x => x.IsActive == request.IsActive)
        /// </example>
        public static IQueryable<T> WhereIf<T>(this IQueryable<T> source, bool condition, Expression<Func<T, bool>> predicate)
            => condition ? source.Where(predicate) : source;

        /// <summary>
        /// Tìm kiếm LIKE '%keyword%' trên nhiều cột (OR). Ký tự % _ [ trong từ khoá được hiểu là chữ thường, không phải ký tự đại diện.
        /// Bỏ qua khi keyword rỗng.
        /// </summary>
        /// <example>
        /// query.ApplySearch(request.Search, x => x.Name, x => x.Description)
        /// </example>
        public static IQueryable<T> ApplySearch<T>(this IQueryable<T> source, string? keyword, params Expression<Func<T, string?>>[] fields)
        {
            if (string.IsNullOrWhiteSpace(keyword) || fields.Length == 0)
                return source;

            var pattern = "%" + EscapeLike(keyword.Trim()) + "%";
            var parameter = Expression.Parameter(typeof(T), "x");
            var likeMethod = typeof(DbFunctionsExtensions).GetMethod(
                nameof(DbFunctionsExtensions.Like), [typeof(DbFunctions), typeof(string), typeof(string)])!;
            var efFunctions = Expression.Property(null, typeof(EF).GetProperty(nameof(EF.Functions))!);
            // Bọc pattern trong closure để EF đưa thành tham số SQL thay vì hằng số
            var patternValue = Expression.Property(Expression.Constant(new { Value = pattern }), "Value");

            Expression? anyMatch = null;
            foreach (var field in fields)
            {
                var column = new ParameterReplaceVisitor(field.Parameters[0], parameter).Visit(field.Body)!;
                var match = Expression.AndAlso(
                    Expression.NotEqual(column, Expression.Constant(null, typeof(string))),
                    Expression.Call(likeMethod, efFunctions, column, patternValue));
                anyMatch = anyMatch is null ? match : Expression.OrElse(anyMatch, match);
            }

            return source.Where(Expression.Lambda<Func<T, bool>>(anyMatch!, parameter));
        }

        /// <summary>
        /// Sắp xếp theo tên cột client gửi lên, chỉ trong danh sách cho phép (key: tên client gửi, value: tên property).
        /// Cột ngoài danh sách thì sắp theo Id: client gửi tên tuỳ ý sẽ không gây lỗi SQL hay lộ cột như PasswordHash.
        /// Luôn nối thêm Id làm khoá phụ: các dòng trùng giá trị sắp xếp có thứ tự cố định, phân trang không lặp hoặc sót dòng.
        /// </summary>
        /// <example>
        /// query.ApplySorting(request.SortBy, request.Desc, SortColumns)
        /// </example>
        public static IOrderedQueryable<T> ApplySorting<T>(
            this IQueryable<T> source, string? sortBy, bool desc, IReadOnlyDictionary<string, string> allowedColumns)
        {
            const string tieBreaker = "Id";
            var column = sortBy is not null && allowedColumns.TryGetValue(sortBy, out var property) ? property : tieBreaker;

            var ordered = desc
                ? source.OrderByDescending(e => EF.Property<object>(e!, column))
                : source.OrderBy(e => EF.Property<object>(e!, column));

            // SQL Server báo lỗi nếu ORDER BY lặp lại cùng một cột
            if (column == tieBreaker)
                return ordered;

            return desc
                ? ordered.ThenByDescending(e => EF.Property<object>(e!, tieBreaker))
                : ordered.ThenBy(e => EF.Property<object>(e!, tieBreaker));
        }

        /// <summary>
        /// Một trang dữ liệu kèm tổng số bản ghi (2 câu lệnh: COUNT và SELECT ... OFFSET/FETCH).
        /// Giới hạn trên của Page và PageSize nằm trong PagedListQueryBase, nên (page - 1) * pageSize không tràn số.
        /// </summary>
        public static async Task<(List<T> Items, long Total)> ToPagedListAsync<T>(
            this IQueryable<T> source, int page, int pageSize, CancellationToken ct = default)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, pageSize);

            var total = await source.LongCountAsync(ct);
            var items = await source.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return (items, total);
        }

        private static string EscapeLike(string input)
            => input.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]");

        private sealed class ParameterReplaceVisitor(ParameterExpression source, ParameterExpression target) : ExpressionVisitor
        {
            protected override Expression VisitParameter(ParameterExpression node)
                => node == source ? target : base.VisitParameter(node);
        }
    }
}
