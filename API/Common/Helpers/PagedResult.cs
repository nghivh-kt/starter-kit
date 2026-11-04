namespace API.Common.Helpers
{
    public class PagedResult<T>
    {
        /// <summary>Dữ liệu trang hiện tại.</summary>
        public IReadOnlyList<T> Items { get; init; } = new List<T>();

        /// <summary>Tổng số bản ghi (chưa phân trang).</summary>
        public long TotalCount { get; init; }

        /// <summary>Trang hiện tại (1-based).</summary>
        public int Page { get; init; }

        /// <summary>Kích thước trang (số bản ghi/trang).</summary>
        public int PageSize { get; init; }

        /// <summary>Tổng số trang (TotalCount / PageSize).</summary>
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

        /// <summary>Chỉ báo xem có trang trước không.</summary>
        public bool HasPrevious => Page > 1;

        /// <summary>Chỉ báo xem có trang kế tiếp không.</summary>
        public bool HasNext => Page < TotalPages;

        public PagedResult() { }

        public PagedResult(IEnumerable<T> items, long totalCount, int page, int pageSize)
        {
            Items = items.ToList();
            TotalCount = totalCount;
            Page = page;
            PageSize = pageSize;
        }
    }
}
