using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using System.Linq.Expressions;

namespace API.Data.Extensions
{
    /// <summary>
    /// Bộ QueryableExtensions hỗ trợ thao tác LINQ động với EF Core.
    /// Toàn bộ hàm đều SQL-translatable (dịch hoàn toàn xuống SQL Server).
    /// </summary>
    public static class QueryableExtensions
    {
        // --------------------------------------------------------------------
        // 🔹 FILTER CƠ BẢN
        // --------------------------------------------------------------------

        /// <summary>
        /// Chỉ áp dụng điều kiện Where nếu <paramref name="condition"/> = true.
        /// Giúp tránh if/else khi build query động.
        /// </summary>
        /// <example>
        /// query.WhereIf(categoryId != null, x => x.CategoryId == categoryId)
        /// </example>
        public static IQueryable<T> WhereIf<T>(
            this IQueryable<T> source,
            bool condition,
            Expression<Func<T, bool>> predicate)
            => condition ? source.Where(predicate) : source;

        /// <summary>
        /// Áp dụng filter (Where) nếu không null.
        /// </summary>
        /// <example>
        /// query.ApplyFilter(filterExpression)
        /// </example>
        public static IQueryable<T> ApplyFilter<T>(
            this IQueryable<T> source,
            Expression<Func<T, bool>>? filter)
            => filter is null ? source : source.Where(filter);

        // --------------------------------------------------------------------
        // 🔹 EQUALS (==)
        // --------------------------------------------------------------------

        /// <summary>
        /// So sánh bằng cho kiểu value-type (int?, bool?, DateTime?, ...).
        /// Bỏ qua nếu giá trị null.
        /// </summary>
        /// <example>
        /// query.ApplyEquals(x => x.CategoryId, query.CategoryId)
        /// </example>
        public static IQueryable<T> ApplyEquals<T, TProp>(
            this IQueryable<T> source,
            Expression<Func<T, TProp>> selector,
            TProp? value)
            where TProp : struct
        {
            if (!value.HasValue) return source;
            var body = Expression.Equal(selector.Body, Expression.Constant(value.Value, typeof(TProp)));
            var lambda = Expression.Lambda<Func<T, bool>>(body, selector.Parameters);
            return source.Where(lambda);
        }

        /// <summary>
        /// So sánh bằng cho kiểu reference-type (string, object...).
        /// Bỏ qua nếu giá trị null.
        /// </summary>
        public static IQueryable<T> ApplyEquals<T, TProp>(
            this IQueryable<T> source,
            Expression<Func<T, TProp>> selector,
            TProp? value)
            where TProp : class
        {
            if (value is null) return source;
            var body = Expression.Equal(selector.Body, Expression.Constant(value, typeof(TProp)));
            var lambda = Expression.Lambda<Func<T, bool>>(body, selector.Parameters);
            return source.Where(lambda);
        }

        // --------------------------------------------------------------------
        // 🔹 IN-LIST (SQL IN (...))
        // --------------------------------------------------------------------

        /// <summary>
        /// Lọc theo danh sách giá trị (SQL IN (...)).
        /// Bỏ qua nếu danh sách rỗng.
        /// </summary>
        /// <example>
        /// query.ApplyInList(x => x.Status, new[] { "Active", "Pending" })
        /// </example>
        public static IQueryable<T> ApplyInList<T, TProp>(
            this IQueryable<T> source,
            Expression<Func<T, TProp>> selector,
            IEnumerable<TProp>? values)
        {
            if (values == null) return source;
            var list = values as ICollection<TProp> ?? values.ToList();
            if (list.Count == 0) return source;

            var param = selector.Parameters[0];
            var body = Expression.Call(
                typeof(Enumerable),
                nameof(Enumerable.Contains),
                new[] { typeof(TProp) },
                Expression.Constant(list),
                selector.Body);

            var lambda = Expression.Lambda<Func<T, bool>>(body, param);
            return source.Where(lambda);
        }

        // --------------------------------------------------------------------
        // 🔹 BETWEEN (>= min AND <= max)
        // --------------------------------------------------------------------

        /// <summary>
        /// Lọc dữ liệu theo khoảng giá trị [min, max].
        /// Thường dùng cho số hoặc ngày.
        /// </summary>
        /// <example>
        /// query.ApplyBetween(x => x.Price, minPrice, maxPrice)
        /// </example>
        public static IQueryable<T> ApplyBetween<T, TProp>(
            this IQueryable<T> source,
            Expression<Func<T, TProp>> selector,
            TProp? min,
            TProp? max)
            where TProp : struct, IComparable<TProp>
        {
            if (min.HasValue)
            {
                var ge = Expression.GreaterThanOrEqual(selector.Body, Expression.Constant(min.Value, typeof(TProp)));
                source = source.Where(Expression.Lambda<Func<T, bool>>(ge, selector.Parameters));
            }

            if (max.HasValue)
            {
                var le = Expression.LessThanOrEqual(selector.Body, Expression.Constant(max.Value, typeof(TProp)));
                source = source.Where(Expression.Lambda<Func<T, bool>>(le, selector.Parameters));
            }

            return source;
        }

        // --------------------------------------------------------------------
        // 🔹 DATE RANGE (DateTime? / DateTime)
        // --------------------------------------------------------------------

        /// <summary>
        /// Lọc dữ liệu theo khoảng ngày [from, to].
        /// Bao gồm cả from và to.
        /// </summary>
        /// <example>
        /// query.ApplyDateRange(x => x.CreatedAt, fromDate, toDate)
        /// </example>
        public static IQueryable<T> ApplyDateRange<T>(
            this IQueryable<T> source,
            Expression<Func<T, DateTime?>> selector,
            DateTime? fromUtc,
            DateTime? toUtcInclusive)
        {
            if (fromUtc.HasValue)
            {
                var ge = Expression.GreaterThanOrEqual(selector.Body, Expression.Constant(fromUtc.Value, typeof(DateTime?)));
                source = source.Where(Expression.Lambda<Func<T, bool>>(ge, selector.Parameters));
            }

            if (toUtcInclusive.HasValue)
            {
                var le = Expression.LessThanOrEqual(selector.Body, Expression.Constant(toUtcInclusive.Value, typeof(DateTime?)));
                source = source.Where(Expression.Lambda<Func<T, bool>>(le, selector.Parameters));
            }

            return source;
        }

        // --------------------------------------------------------------------
        // 🔹 SEARCH (LIKE '%keyword%')
        // --------------------------------------------------------------------

        /// <summary>
        /// Tìm kiếm toàn văn (LIKE '%keyword%') trên nhiều cột.
        /// Dịch hoàn toàn xuống SQL (dùng EF.Functions.Like).
        /// </summary>
        /// <example>
        /// query.ApplySearch("apple", x => x.Name, x => x.Description)
        /// </example>
        public static IQueryable<T> ApplySearch<T>(
            this IQueryable<T> source,
            string? keyword,
            params Expression<Func<T, string?>>[] fields)
        {
            if (string.IsNullOrWhiteSpace(keyword) || fields.Length == 0)
                return source;

            var pattern = "%" + EscapeLike(keyword.Trim()) + "%";
            var param = Expression.Parameter(typeof(T), "x");

            Expression? orExpr = null;
            var efFunctionsProp = typeof(EF).GetProperty(nameof(EF.Functions))!;
            var dbFuncExpr = Expression.Property(null, efFunctionsProp);
            var likeMethod = typeof(DbFunctionsExtensions).GetMethod(
                nameof(DbFunctionsExtensions.Like),
                new[] { typeof(DbFunctions), typeof(string), typeof(string) })!;

            foreach (var field in fields)
            {
                var body = ReplaceParameter(field.Body, field.Parameters[0], param);
                var notNull = Expression.NotEqual(body, Expression.Constant(null, typeof(string)));
                var likeCall = Expression.Call(likeMethod, dbFuncExpr, body, Expression.Constant(pattern));
                var and = Expression.AndAlso(notNull, likeCall);
                orExpr = orExpr == null ? and : Expression.OrElse(orExpr, and);
            }

            var lambda = Expression.Lambda<Func<T, bool>>(orExpr!, param);
            return source.Where(lambda);
        }

        // --------------------------------------------------------------------
        // 🔹 SORTING
        // --------------------------------------------------------------------

        /// <summary>
        /// Sắp xếp theo biểu thức (typed).
        /// </summary>
        /// <example>
        /// query.ApplySorting(x => x.CreatedAt, desc: true)
        /// </example>
        public static IOrderedQueryable<T> ApplySorting<T, TKey>(
            this IQueryable<T> source,
            Expression<Func<T, TKey>> keySelector,
            bool desc = false)
            => desc ? source.OrderByDescending(keySelector) : source.OrderBy(keySelector);

        /// <summary>
        /// Sắp xếp động theo tên cột (string sortBy), kèm khoá phụ <paramref name="tieBreaker"/> (mặc định Id).
        /// Khoá phụ giúp các dòng trùng giá trị sắp xếp (ví dụ cùng CreatedAt) luôn có thứ tự cố định,
        /// nếu không SQL Server trả thứ tự tuỳ ý và phân trang có thể lặp hoặc bỏ sót dòng giữa các trang.
        /// Truyền tieBreaker = null nếu entity không có cột Id.
        /// </summary>
        /// <example>
        /// query.ApplySorting("Name", desc: true, defaultSort: "CreatedAt")
        /// </example>
        public static IOrderedQueryable<T> ApplySorting<T>(
            this IQueryable<T> source,
            string? sortBy,
            bool desc = false,
            string defaultSort = "Id",
            string? tieBreaker = "Id")
        {
            var column = string.IsNullOrWhiteSpace(sortBy) ? defaultSort : sortBy.Trim();
            var ordered = desc
                ? source.OrderByDescending(e => EF.Property<object>(e!, column))
                : source.OrderBy(e => EF.Property<object>(e!, column));

            // Không nối khi cột sắp xếp đã là khoá phụ: SQL Server báo lỗi nếu ORDER BY trùng cột
            if (tieBreaker is null || string.Equals(column, tieBreaker, StringComparison.OrdinalIgnoreCase))
                return ordered;

            return desc
                ? ordered.ThenByDescending(e => EF.Property<object>(e!, tieBreaker))
                : ordered.ThenBy(e => EF.Property<object>(e!, tieBreaker));
        }

        // --------------------------------------------------------------------
        // 🔹 PAGING
        // --------------------------------------------------------------------

        /// <summary>
        /// Áp dụng phân trang theo Page & PageSize (Skip/Take).
        /// </summary>
        public static IQueryable<T> ApplyPaging<T>(
            this IQueryable<T> source,
            int page,
            int pageSize)
        {
            var p = Math.Max(1, page);
            var size = Math.Clamp(pageSize, 1, 200);
            return source.Skip((p - 1) * size).Take(size);
        }

        /// <summary>
        /// Trả về dữ liệu phân trang cùng tổng bản ghi (items + total).
        /// </summary>
        public static async Task<(List<T> Items, long Total)> ToPagedListAsync<T>(
            this IQueryable<T> source,
            int page,
            int pageSize,
            CancellationToken ct = default)
        {
            var total = await source.LongCountAsync(ct);
            var items = await source.ApplyPaging(page, pageSize).ToListAsync(ct);
            return (items, total);
        }

        // --------------------------------------------------------------------
        // 🔹 INCLUDE & TRACKING
        // --------------------------------------------------------------------

        /// <summary>
        /// Include nhiều navigation property cấp 1 (không ThenInclude).
        /// </summary>
        public static IQueryable<T> ApplyIncludes<T>(
            this IQueryable<T> query,
            params Expression<Func<T, object>>[] includes)
            where T : class
        {
            if (includes == null || includes.Length == 0)
                return query;

            foreach (var include in includes)
                query = query.Include(include);

            return query;
        }

        /// <summary>
        /// Include nâng cao (hỗ trợ ThenInclude).
        /// </summary>
        public static IQueryable<T> ApplyIncludes<T>(
            this IQueryable<T> query,
            params Func<IQueryable<T>, IIncludableQueryable<T, object>>[] includeFuncs)
            where T : class
        {
            if (includeFuncs == null || includeFuncs.Length == 0)
                return query;

            foreach (var includeFunc in includeFuncs)
                query = includeFunc(query);

            return query;
        }

        /// <summary>
        /// Bật/tắt AsNoTracking (đọc-only, không tracking entity).
        /// </summary>
        public static IQueryable<T> UseNoTracking<T>(
            this IQueryable<T> source,
            bool enable = true)
            where T : class
            => enable ? source.AsNoTracking() : source;

        // --------------------------------------------------------------------
        // 🔹 PRIVATE HELPER
        // --------------------------------------------------------------------

        private static string EscapeLike(string input)
            => input.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]");

        private static Expression ReplaceParameter(Expression body, ParameterExpression source, ParameterExpression target)
            => new ParameterReplaceVisitor(source, target).Visit(body)!;

        private sealed class ParameterReplaceVisitor : ExpressionVisitor
        {
            private readonly ParameterExpression _source;
            private readonly ParameterExpression _target;
            public ParameterReplaceVisitor(ParameterExpression source, ParameterExpression target)
                => (_source, _target) = (source, target);

            protected override Expression VisitParameter(ParameterExpression node)
                => node == _source ? _target : base.VisitParameter(node);
        }
    }
}
