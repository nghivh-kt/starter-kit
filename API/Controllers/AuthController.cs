using API.Common.Exceptions;
using API.Common.Security;
using API.Models.DTOs;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Net.Mime;

namespace API.Controllers
{
    // Viết thường, không dùng [controller]: đường dẫn cookie phân biệt hoa thường, gọi /api/Auth thì cookie Path=/api/auth không được gửi
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        // Cookie refresh token chỉ được trình duyệt gửi kèm các request tới /api/auth/*, không lộ ra endpoint khác
        private const string RefreshCookiePath = "/api/auth";

        private readonly IAuthService _authService;
        private readonly IUserContext _userContext;
        private readonly RefreshTokenSettings _refreshTokenSettings;
        private readonly string[] _allowedOrigins;

        public AuthController(IAuthService authService, IUserContext userContext, IOptions<RefreshTokenSettings> refreshTokenSettings, IConfiguration configuration)
        {
            _authService = authService;
            _userContext = userContext;
            _refreshTokenSettings = refreshTokenSettings.Value;
            _allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        }

        // LOGIN
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.Login)]
        [HttpPost("login")]
        [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest rq, CancellationToken ct)
        {
            var result = await _authService.LoginAsync(rq.UserName, rq.Password, _userContext.IpAddress, ct);

            return Ok(WithRefreshCookie(result));
        }

        // REFRESH TOKEN
        // AllowAnonymous: client gọi refresh đúng lúc access token đã hết hạn, nên không thể đòi access token hợp lệ.
        // Endpoint được bảo vệ bằng chính refresh token (cookie HttpOnly hoặc body).
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.Refresh)]
        [HttpPost("refresh")]
        [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<AuthResponse>> Refresh([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RefreshTokenRequest? rq, CancellationToken ct)
        {
            EnsureTrustedOrigin();

            // Lấy plaintext từ cookie hoặc body (tùy config). Chế độ cookie không cần gửi body.
            var tokenPlain = _refreshTokenSettings.UseCookie ? Request.Cookies[_refreshTokenSettings.CookieName] : rq?.RefreshToken;

            if (string.IsNullOrWhiteSpace(tokenPlain))
            {
                throw new UnauthorizedException("Không tìm thấy refresh token");
            }

            var result = await _authService.RefreshAsync(tokenPlain, _userContext.IpAddress, ct);

            return Ok(WithRefreshCookie(result));
        }

        // LOGOUT
        [AllowAnonymous]
        [HttpPost("logout")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> Logout([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LogoutRequest? rq)
        {
            EnsureTrustedOrigin();

            // Lấy plaintext từ cookie hoặc body (tùy config). Chế độ cookie không cần gửi body.
            var tokenPlain = _refreshTokenSettings.UseCookie ? Request.Cookies[_refreshTokenSettings.CookieName] : rq?.RefreshToken;

            if (!string.IsNullOrWhiteSpace(tokenPlain))
            {
                // Không dùng RequestAborted: client đóng tab giữa chừng thì token vẫn phải được thu hồi
                await _authService.LogoutAsync(tokenPlain, _userContext.IpAddress, CancellationToken.None);
            }

            DeleteRefreshCookie();
            return NoContent();
        }

        // LOGOUT ALL — đăng xuất mọi thiết bị của user hiện tại.
        [Authorize]
        [HttpPost("logout-all")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> LogoutAll()
        {
            await _authService.LogoutAllAsync(CurrentUserId(), _userContext.IpAddress, CancellationToken.None);

            DeleteRefreshCookie();
            return NoContent();
        }

        // CHANGE PASSWORD — đổi xong mọi phiên bị thu hồi, client phải đăng nhập lại
        [Authorize]
        [EnableRateLimiting(RateLimitPolicies.Login)]
        [HttpPost("change-password")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests, MediaTypeNames.Application.ProblemJson)]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest rq, CancellationToken ct)
        {
            await _authService.ChangePasswordAsync(CurrentUserId(), rq, _userContext.IpAddress, ct);

            DeleteRefreshCookie();
            return NoContent();
        }

        // CURRENT USER INFO
        [Authorize]
        [HttpGet("me")]
        [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
        public async Task<ActionResult<CurrentUserResponse>> Me(CancellationToken ct)
        {
            var currentUser = await _authService.CurrentUserAsync(CurrentUserId(), ct)
                ?? throw new UnauthorizedException("Tài khoản không tồn tại hoặc đã bị khóa");

            return Ok(currentUser);
        }

        // --------------------------------------------------------------------
        // Helpers
        // --------------------------------------------------------------------

        // [Authorize] đảm bảo đã đăng nhập; thiếu claim uid nghĩa là token không do hệ thống này cấp
        private int CurrentUserId() =>
            _userContext.UserId ?? throw new UnauthorizedException("Access token không hợp lệ.");

        // SameSite=None: trình duyệt gửi cookie kèm cả request từ site khác, nên phải tự chặn CSRF bằng header Origin.
        // Chỉ refresh/logout cần: đây là các endpoint xác thực bằng cookie, còn lại dùng Bearer token nên không bị CSRF.
        private void EnsureTrustedOrigin()
        {
            if (!_refreshTokenSettings.UseCookie || _refreshTokenSettings.CookieSameSite != SameSiteMode.None) return;

            if (!_allowedOrigins.Contains(Request.Headers.Origin.ToString(), StringComparer.OrdinalIgnoreCase))
            {
                throw new ForbiddenException("Nguồn gửi request không được phép.");
            }
        }

        // Chế độ cookie: đưa refresh token vào cookie HttpOnly và bỏ khỏi body để JavaScript không đọc được
        private AuthResponse WithRefreshCookie(AuthResponse result)
        {
            if (_refreshTokenSettings.UseCookie && !string.IsNullOrEmpty(result.RefreshToken))
            {
                Response.Cookies.Append(_refreshTokenSettings.CookieName, result.RefreshToken, RefreshCookieOptions(result.RefreshTokenExpiresAt));
                result.RefreshToken = null;
            }

            return result;
        }

        // Xoá cookie phải dùng cùng Path/SameSite/Secure với lúc tạo, nếu không trình duyệt sẽ giữ cookie cũ
        private void DeleteRefreshCookie()
        {
            if (_refreshTokenSettings.UseCookie)
            {
                Response.Cookies.Delete(_refreshTokenSettings.CookieName, RefreshCookieOptions(expiresAt: null));
            }
        }

        private CookieOptions RefreshCookieOptions(DateTime? expiresAt) => new()
        {
            HttpOnly = true,
            Secure = _refreshTokenSettings.CookieSecure,
            SameSite = _refreshTokenSettings.CookieSameSite,
            Path = RefreshCookiePath,
            Expires = expiresAt
        };
    }
}
