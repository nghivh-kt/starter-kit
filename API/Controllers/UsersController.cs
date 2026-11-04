using API.Common.Security;
using API.Models.DTOs;
using API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/[controller]")]
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
        public async Task<IActionResult> GetPaged([FromQuery] UserQueryRequest query, CancellationToken ct)
        {
            return Ok(await _userService.GetPagedAsync(query, ct));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            return Ok(await _userService.GetUserByIdAsync(id, ct));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] UserCreateRequest request, CancellationToken ct)
        {
            // Request đã được FluentValidationFilter validate trước khi vào đây
            var created = await _userService.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UserUpdateRequest request, CancellationToken ct)
        {
            return Ok(await _userService.UpdateAsync(id, request, ct));
        }

        [HttpPut("{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] UserResetPasswordRequest request, CancellationToken ct)
        {
            await _userService.ResetPasswordAsync(id, request, ct);
            return NoContent();
        }
    }
}
