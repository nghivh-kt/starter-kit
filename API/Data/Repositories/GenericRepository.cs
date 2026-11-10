using API.Data.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace API.Data.Repositories
{
    /// <summary>
    /// Bọc DbSet&lt;T&gt; của EFDbContext. Cố ý không có Update(entity): lệnh đó đánh dấu mọi cột là đã sửa (UPDATE ghi đè cả dòng,
    /// cột nào object thiếu thì thành rỗng) và AuditLog mất giá trị cũ. Muốn sửa: QueryForEdit(), gán property, SaveChangesAsync.
    /// </summary>
    public class GenericRepository<T> : IGenericRepository<T> where T : class
    {
        private readonly DbSet<T> _dbSet;

        public GenericRepository(EFDbContext context)
        {
            _dbSet = context.Set<T>();
        }

        public IQueryable<T> Query() => _dbSet.AsNoTracking();

        public IQueryable<T> QueryForEdit() => _dbSet;

        public async Task AddAsync(T entity, CancellationToken cancellationToken = default)
        {
            await _dbSet.AddAsync(entity, cancellationToken);
        }

        public async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
        {
            await _dbSet.AddRangeAsync(entities, cancellationToken);
        }

        public void Delete(T entity)
        {
            _dbSet.Remove(entity);
        }

        public void DeleteRange(IEnumerable<T> entities)
        {
            _dbSet.RemoveRange(entities);
        }

        public Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return _dbSet.AnyAsync(predicate, cancellationToken);
        }
    }
}
