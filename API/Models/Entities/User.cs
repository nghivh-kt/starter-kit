using System.ComponentModel.DataAnnotations.Schema;

namespace API.Models.Entities
{
    [Table("Users")]
    public class User : AuditableEntity
    {
        public string UserName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // Xem Common/Security/Roles.cs

        /// <summary>Số lần nhập sai mật khẩu liên tiếp. Về 0 khi đăng nhập đúng hoặc khi bị khoá tạm.</summary>
        public int FailedLoginCount { get; set; }

        /// <summary>Khoá tạm đến thời điểm này (UTC) do nhập sai mật khẩu nhiều lần. Null hoặc đã qua: không bị khoá.</summary>
        public DateTime? LockoutEnd { get; set; }
    }
}
