const userMenu = document.querySelector('.user-menu')
const openUserMenu = document.querySelector('.open-user-menu')
const closeUserMenu = document.querySelector('.close-user-menu')
const overlayDashboard = document.querySelector('.search-overlay')

// null-safe: اگر روی صفحه‌ای یکی از عناصر نبود، اسکریپت خطا ندهد و بقیه‌ی
// listenerها هم از کار نیفتند (قبلاً نبودِ یک عنصر کلِ اسکریپت را متوقف می‌کرد)
if (openUserMenu && userMenu) {
  openUserMenu.addEventListener('click', () => {
    userMenu.classList.add('active')
    if (overlayDashboard) overlayDashboard.classList.add('active')
  })
}

if (overlayDashboard && userMenu) {
  overlayDashboard.addEventListener('click', () => {
    userMenu.classList.remove('active')
    overlayDashboard.classList.remove('active')
  })
}

if (closeUserMenu && userMenu) {
  closeUserMenu.addEventListener('click', () => {
    userMenu.classList.remove('active')
    if (overlayDashboard) overlayDashboard.classList.remove('active')
  })
}
