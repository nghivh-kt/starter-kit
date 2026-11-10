using API.Common.Helpers;
using API.Common.Security;
using API.Models.DTOs;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;

namespace API.Controllers
{
    [Route("api/users")]
    [ApiController]
    [Authorize(Roles = Roles.Admin)]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet]
        [ProducesResponseType<PagedResult<UserResponse>>(StatusCodes.Status200OK)]
        public async Task<ActionResult<PagedResult<UserResponse>>> GetPaged([FromQuery] UserQueryRequest query, CancellationToken ct)
        {
            return Ok(await _userService.GetPagedAsync(query, ct));
        }

        /// <summary>Mọi dòng khớp bộ lọc hiện tại dưới dạng file Excel, bỏ qua Page và PageSize.</summary>
        [HttpGet("export")]
        [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK, ExcelExporter.ContentType)]
        public async Task<IActionResult> Export([FromQuery] UserQueryRequest query, CancellationToken ct)
        {
            return File(await _userService.ExportAsync(query, ct), ExcelExporter.ContentType, "nguoi-dung.xlsx");
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<UserResponse>> GetById(int id, CancellationToken ct)
        {
            return Ok(await _userService.GetUserByIdAsync(id, ct));
        }

        [HttpPost]
        [ProducesResponseType<UserResponse>(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<UserResponse>> Create([FromBody] UserCreateRequest request, CancellationToken ct)
        {
            // Request đã được FluentValidationFilter validate trước khi vào đây
            var created = await _userService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id:int}")]
        [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict, MediaTypeNames.Application.ProblemJson)]
        public async Task<ActionResult<UserResponse>> Update(int id, [FromBody] UserUpdateRequest request, CancellationToken ct)
        {
            return Ok(await _userService.UpdateAsync(id, request, ct));
        }

        [HttpPut("{id:int}/reset-password")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, MediaTypeNames.Application.ProblemJson)]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] UserResetPasswordRequest request, CancellationToken ct)
        {
            await _userService.ResetPasswordAsync(id, request, ct);
            return NoContent();
        }
    }
}
