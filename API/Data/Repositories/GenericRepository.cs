using API.Data.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace API.Data.Repositories
{
    public class GenericRepository<T> : IGenericRepository<T> where T : class
    {
        protected readonly EFDbContext _context;
        private readonly DbSet<T> _dbSet;

        public GenericRepository(EFDbContext context)
        {
            _context = context;
            _dbSet = _context.Set<T>();
        }

        public IQueryable<T> Query(bool asNoTracking = true)
        {
            return asNoTracking ? _dbSet.AsNoTracking() : _dbSet;
        }

        public async Task<T?> GetByIdAsync(object key, CancellationToken cancellationToken = default)
        {
            // Gọi rõ overload (mảng khoá, token). FindAsync(key, token) cũng chạy được vì EF tự tách token khỏi params,
            // nhưng cách đó dựa vào hành vi ngầm của EF.
            return await _dbSet.FindAsync([key], cancellationToken).ConfigureAwait(false);
        }

        public async Task<T?> GetByIdAsync(object[] keys, CancellationToken cancellationToken = default)
        {
            return await _dbSet.FindAsync(keys, cancellationToken).ConfigureAwait(false);
        }

        public async Task AddAsync(T entity, CancellationToken cancellationToken = default)
        {
            await _dbSet.AddAsync(entity, cancellationToken).ConfigureAwait(false);
        }

        public async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
        {
            await _dbSet.AddRangeAsync(entities, cancellationToken).ConfigureAwait(false);
        }

        public void Update(T entity)
        {
            // Lấy entry một lần duy nhất để tối ưu hiệu năng
            var entry = _context.Entry(entity);

            // Nếu Entity chưa được track bởi EF Core (thường là từ DTO hoặc AsNoTracking)
            if (entry.State == EntityState.Detached)
                _dbSet.Attach(entity);

            // Đánh dấu toàn bộ Entity là đã thay đổi để chuẩn bị cho lệnh UPDATE
            entry.State = EntityState.Modified;
        }

        public void UpdateRange(IEnumerable<T> entities)
        {
            foreach (var e in entities)
            {
                var entry = _context.Entry(e);

                if (entry.State == EntityState.Detached)
                    _dbSet.Attach(e);

                entry.State = EntityState.Modified;
            }
        }

        public void Delete(T entity)
        {
            var entry = _context.Entry(entity);

            // Nếu Entity ở trạng thái Detached, phải Attach vào thì EF mới biết đối tượng nào để xóa
            if (entry.State == EntityState.Detached)
                _dbSet.Attach(entity);

            // Đánh dấu trạng thái là Deleted (sẽ sinh lệnh DELETE khi SaveChanges)
            _dbSet.Remove(entity);
        }

        public void DeleteRange(IEnumerable<T> entities)
        {
            foreach (var e in entities)
            {
                var entry = _context.Entry(e);

                if (entry.State == EntityState.Detached)
                    _dbSet.Attach(e);
            }

            // Xóa hàng loạt sau khi tất cả đã được Attach thành công
            _dbSet.RemoveRange(entities);
        }

        public Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return _dbSet.AnyAsync(predicate, cancellationToken);
        }        
    }
}
