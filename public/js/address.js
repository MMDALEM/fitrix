
    // دریافت المان‌ها
    const modal = document.getElementById('addressModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveAddressBtn = document.getElementById('saveAddressBtn');
    const addressList = document.getElementById('addressList');

    // باز کردن مودال
    openModalBtn.addEventListener('click', () => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // غیرفعال کردن اسکرول صفحه
    });

    // بستن مودال
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // فعال کردن اسکرول صفحه
        clearForm();
    }

    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // بستن مودال با کلیک روی پس‌زمینه
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // بستن با کلید Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    // پاک کردن فرم
    function clearForm() {
        document.getElementById('addressName').value = '';
        document.getElementById('province').value = '';
        document.getElementById('city').value = '';
        document.getElementById('fullAddress').value = '';
        document.getElementById('postalCode').value = '';
        document.getElementById('recipient').value = '';
        document.getElementById('phone').value = '';
    }

    // ذخیره آدرس جدید
    saveAddressBtn.addEventListener('click', () => {
        const addressName = document.getElementById('addressName').value.trim();
        const province = document.getElementById('province').value.trim();
        const city = document.getElementById('city').value.trim();
        const fullAddress = document.getElementById('fullAddress').value.trim();
        const postalCode = document.getElementById('postalCode').value.trim();
        const recipient = document.getElementById('recipient').value.trim();
        const phone = document.getElementById('phone').value.trim();

        // اعتبارسنجی
        if (!addressName || !province || !city || !fullAddress || !postalCode || !recipient || !phone) {
            alert('لطفاً تمام فیلدها را پر کنید');
            return;
        }

        if (postalCode.length !== 10) {
            alert('کد پستی باید 10 رقم باشد');
            return;
        }

        if (phone.length !== 11 || !phone.startsWith('09')) {
            alert('شماره تماس باید 11 رقم و با 09 شروع شود');
            return;
        }

        // ساخت آدرس جدید
        const newAddress = document.createElement('li');
        newAddress.className = 'relative w-full border border-blue-300 dark:border-blue-400 p-4 rounded-lg';
        newAddress.innerHTML = `
            <span class="flex items-center gap-x-1 text-blue-500 dark:text-blue-400">
                <span class="text-xl">📍</span>
                <h2 class="font-DanaMedium">${addressName}</h2>
            </span>
            <div class="space-y-1.5 text-gray-600 dark:text-gray-300 mt-3 mr-2">
                <p>${province} - ${city} - ${fullAddress}</p>
                <p>کد پستی: ${postalCode}</p>
                <p>گیرنده: ${recipient}</p>
                <p>شماره تماس: ${phone}</p>
            </div>
            <span class="absolute left-4 bottom-3 flex items-center gap-x-4">
                <button class="text-blue-500 hover:text-blue-600">
                    <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
                <button class="delete-btn text-red-500 hover:text-red-600">
                    <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </span>
        `;

        // افزودن قابلیت حذف
        const deleteBtn = newAddress.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm('آیا از حذف این آدرس اطمینان دارید؟')) {
                newAddress.remove();
            }
        });

        // اضافه کردن به لیست
        addressList.appendChild(newAddress);

        // بستن مودال و پاک کردن فرم
        closeModal();
        
        // نمایش پیام موفقیت
        alert('آدرس جدید با موفقیت اضافه شد');
    });