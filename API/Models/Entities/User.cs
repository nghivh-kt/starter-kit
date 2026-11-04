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
    }
}
