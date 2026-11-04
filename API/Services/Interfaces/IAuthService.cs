using API.Models.DTOs;

namespace API.Services.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponse> LoginAsync(string username, string password, string ip, CancellationToken ct);
        Task<AuthResponse> RefreshAsync(string refreshToken, string ip, CancellationToken ct);
        Task LogoutAsync(string refreshToken, string ip, CancellationToken ct);
        Task LogoutAllAsync(int userId, string ip, CancellationToken ct);
        Task ChangePasswordAsync(int userId, ChangePasswordRequest request, string ip, CancellationToken ct);
        Task<CurrentUserResponse?> CurrentUserAsync(int userId, CancellationToken ct);
    }
}
