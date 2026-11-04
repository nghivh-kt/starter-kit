using System.ComponentModel.DataAnnotations;

namespace API.Models.DTOs.Common
{
    /// <summary>
    /// Lớp cơ sở chung cho tất cả các truy vấn dạng danh sách (List Query / Paged Query).
    /// Hỗ trợ phân trang, tìm kiếm, lọc trạng thái, và sắp xếp.
    /// </summary>
    public class PagedListQueryBase
    {
        /// <summary>Từ khóa tìm kiếm (áp dụng cho nhiều cột trong ApplySearch).</summary>
        [MaxLength(200, ErrorMessage = "Từ khoá tìm kiếm tối đa 200 ký tự.")]
        public string? Search { get; set; }

        /// <summary>Lọc theo trạng thái Active/Inactive (nếu entity có trường IsActive).</summary>
        public bool? IsActive { get; set; }

        /// <summary>Trang hiện tại (1-based). Có giới hạn trên để (Page - 1) * PageSize không tràn số int ở ApplyPaging.</summary>
        [Range(1, 1_000_000, ErrorMessage = "Page phải trong khoảng 1–1000000.")]
        public int Page { get; set; } = 1;

        /// <summary>Kích thước trang (số item mỗi trang).</summary>
        [Range(1, 200, ErrorMessage = "PageSize phải trong khoảng 1–200.")]
        public int PageSize { get; set; } = 20;

        /// <summary>Tên cột để sắp xếp (ví dụ: 'CreatedAt', 'Name', 'Price').</summary>
        public string? SortBy { get; set; } = "CreatedAt";

        /// <summary>Có sắp xếp giảm dần không (true = DESC, false = ASC).</summary>
        public bool Desc { get; set; } = false;
    }
}
