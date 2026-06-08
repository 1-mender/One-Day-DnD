document.addEventListener('DOMContentLoaded', () => {
    // --- Звуковые эффекты ---
    const SOUNDS = {
        CLICK: 'sounds/click.mp3',
        OPEN: 'sounds/open.mp3',
        CLOSE: 'sounds/close.mp3',
        MINIMIZE: 'sounds/minimize.mp3',
        START: 'sounds/start.mp3',
        TYPING: 'sounds/typing.mp3',
        AMBIENT: 'sounds/ambient.mp3',
        DECRYPT: 'sounds/decrypt.mp3', // Пожалуйста, добавьте этот звуковой файл в папку 'sounds'
        GLITCH: 'sounds/glitch.mp3', // Please add this sound file
        USB_CONNECT: 'sounds/usb_connect.mp3' // Please add this sound file
    };

    let notepadEffectTimeouts = [];
    let notepadEffectSound = null;

    // Воспроизведение звуков разрешено только после первого клика пользователя
    let canPlaySounds = false;
    document.body.addEventListener('click', () => {
        if (!canPlaySounds) {
            canPlaySounds = true;
            const ambientSound = new Audio(SOUNDS.AMBIENT);
            ambientSound.loop = true;
            ambientSound.volume = 0.1; // Сделаем фон негромким
            ambientSound.play().catch(e => console.error("Ambient sound play failed:", e));
        }
    }, { once: true });

    function playSound(soundUrl) {
        if (!canPlaySounds) return;
        if (!soundUrl) return; // Защита от пустых ссылок на звук
        const audio = new Audio(soundUrl);
        console.log('Пытаюсь воспроизвести звук:', audio.src); // Эта строка поможет нам в отладке
        audio.play().catch(e => console.error(`Не удалось воспроизвести ${soundUrl}:`, e));
    }

    function showNotification(message) {
        const notificationArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = message;
        notificationArea.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000); // Уведомление исчезнет через 5 секунд
    }

    // Функционал часов
    const clockElement = document.getElementById('clock');
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        clockElement.textContent = timeString;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Функционал меню "Пуск"
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    startButton.addEventListener('click', (event) => {
        playSound(SOUNDS.START);
        event.stopPropagation(); // Предотвратить немедленное закрытие меню
        startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
    });

    // Скрывать меню "Пуск" при клике вне его
    document.addEventListener('click', (event) => {
        if (!startMenu.contains(event.target) && event.target !== startButton) {
            startMenu.style.display = 'none';
        }
    });

    const taskbarApps = document.getElementById('taskbar-apps');
    let zIndexCounter = 20;

    function focusWindow(windowElement) {
        if (!windowElement) return;
        
        // Bring window to front
        zIndexCounter++;
        windowElement.style.zIndex = zIndexCounter;

        // Update active state for window and taskbar tab
        document.querySelectorAll('.window.active, .taskbar-tab.active').forEach(el => {
            el.classList.remove('active');
        });
        windowElement.classList.add('active');
        const activeTab = document.querySelector(`.taskbar-tab[data-window-id="${windowElement.id}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }


    function openWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (!windowElement) return;

        // If window is minimized, just show it and focus
        if (windowElement.classList.contains('minimized')) {
            windowElement.classList.remove('minimized');
            playSound(SOUNDS.OPEN);
            focusWindow(windowElement);
            return;
        }

        // If window is already open, just focus it
        if (windowElement.style.display === 'flex') {
            focusWindow(windowElement);
            return;
        }

        // Otherwise, open it for the first time
        windowElement.style.display = 'flex';
        focusWindow(windowElement);
        playSound(SOUNDS.OPEN);

        // Glitch effect for sensitive files
        const sensitiveFiles = ['notepad-window', 'clayton-dossier-window', 'novak-dossier-window', 'kennedy-dossier-window', 'vance-dossier-window'];
        if (sensitiveFiles.includes(windowId)) {
            triggerGlitch();
        }

        // Typewriter effect for notepad
        if (windowId === 'notepad-window') {
            handleNotepadEffect(windowElement);
        }

        // Initialize stat bars if it's a dossier window
        if (windowElement.id.includes('-dossier-')) {
            initializeStatBars(windowElement);
        }

        // Create taskbar tab if it doesn't exist
        if (!document.querySelector(`.taskbar-tab[data-window-id="${windowId}"]`)) {
            const tab = document.createElement('div');
            tab.className = 'taskbar-tab';
            tab.dataset.windowId = windowId;
            tab.textContent = windowElement.querySelector('.title').textContent;
            
            tab.addEventListener('click', () => {
                openWindow(windowId);
            });

            taskbarApps.appendChild(tab);

            // Flash the new tab
            tab.classList.add('flashing');
            setTimeout(() => {
                if (tab) { // Check if tab still exists
                    tab.classList.remove('flashing');
                }
            }, 1500); // 3 flashes * 0.5s per flash
        }
    }

    // Открытие/закрытие окон
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    
    desktopIcons.forEach(icon => {
        // Открытие окон по ОДИНОЧНОМУ клику (удобнее для мобильных)
        icon.addEventListener('click', () => {
            playSound(SOUNDS.CLICK);
            openWindow(icon.getAttribute('data-opens'));
        });
    });

    function closeWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (windowElement) {
            if (windowId === 'notepad-window') {
                stopNotepadEffect();
            }
            if (windowElement.style.display !== 'none') {
                playSound(SOUNDS.CLOSE);
                // Add closing animation
                windowElement.classList.add('closing');

                // Wait for animation to finish before hiding
                setTimeout(() => {
                    windowElement.style.display = 'none';
                    windowElement.classList.remove('closing'); // Reset for next time
                }, 150);
            }

        }
        // Remove taskbar tab
        const tab = document.querySelector(`.taskbar-tab[data-window-id="${windowId}"]`);
        if (tab) {
            tab.remove();
        }
    }

    function minimizeWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (windowElement) {
            if (windowId === 'notepad-window') {
                stopNotepadEffect();
            }
            if (!windowElement.classList.contains('minimized')) {
                playSound(SOUNDS.MINIMIZE);
                windowElement.classList.add('minimized');
            }
        }
    }

    function toggleMaximize(windowId) {
        const windowElement = document.getElementById(windowId);
        if (!windowElement) return;

        const isMaximized = windowElement.classList.toggle('maximized');

        if (isMaximized) {
            // Store old position and size before maximizing
            windowElement.dataset.oldTop = windowElement.style.top || `${windowElement.offsetTop}px`;
            windowElement.dataset.oldLeft = windowElement.style.left || `${windowElement.offsetLeft}px`;
            windowElement.dataset.oldWidth = windowElement.style.width || `${windowElement.offsetWidth}px`;
            windowElement.dataset.oldHeight = windowElement.style.height || `${windowElement.offsetHeight}px`;
        } else {
            // Restore to old position and size
            windowElement.style.top = windowElement.dataset.oldTop;
            windowElement.style.left = windowElement.dataset.oldLeft;
            windowElement.style.width = windowElement.dataset.oldWidth;
            windowElement.style.height = windowElement.dataset.oldHeight;
        }
    }

    function triggerGlitch() {
        const desktop = document.getElementById('desktop');
        playSound(SOUNDS.GLITCH);
        desktop.classList.add('glitch-effect');
        setTimeout(() => {
            desktop.classList.remove('glitch-effect');
        }, 250);
    }

    function initializeStatBars(windowElement) {
        const statItems = windowElement.querySelectorAll('.stat-item');
        statItems.forEach(item => {
            // Prevent re-initialization
            if (item.querySelector('.stat-bar')) return;

            const value = parseInt(item.dataset.value, 10);
            const statBar = document.createElement('div');
            statBar.className = 'stat-bar';

            const statBarInner = document.createElement('div');
            statBarInner.className = 'stat-bar-inner';
            
            statBar.appendChild(statBarInner);
            item.appendChild(statBar);

            setTimeout(() => statBarInner.style.width = `${value * 10}%`, 100);
        });
    }

    function stopNotepadEffect() {
        // Очищаем все запланированные тайм-ауты для эффекта
        notepadEffectTimeouts.forEach(clearTimeout);
        notepadEffectTimeouts = [];
    
        // Останавливаем звук
        if (notepadEffectSound) {
            notepadEffectSound.pause();
            notepadEffectSound = null;
        }
    }

    async function handleNotepadEffect(notepadWindow) {
        const textarea = notepadWindow.querySelector('.notepad-textarea');
        // Если анимация завершена, просто показываем полный текст и выходим
        if (textarea.dataset.typed === 'true') {
            textarea.value = textarea.dataset.text.replace(/&#10;/g, '\n');
            return;
        }
    
        stopNotepadEffect(); // Останавливаем любой предыдущий запуск

        const text = textarea.dataset.text.replace(/&#10;/g, '\n');
        textarea.value = '';
        textarea.dataset.typed = 'true'; // Устанавливаем в true сразу. Теперь окно будет открываться мгновенно.
    
        notepadEffectSound = new Audio(SOUNDS.DECRYPT);
        notepadEffectSound.loop = true;
        if (canPlaySounds) notepadEffectSound.play().catch(e => {});
    
        const lines = text.split('\n');
    
        const sleep = ms => new Promise(res => {
            const timeoutId = setTimeout(res, ms);
            notepadEffectTimeouts.push(timeoutId);
        });
    
        for (const line of lines) {
            if (line.trim() === '') {
                textarea.value += '\n';
                await sleep(100);
            } else {
                const originalValue = textarea.value;
                textarea.value += 'DECRYPTING BLOCK... █';
                textarea.scrollTop = textarea.scrollHeight;
                await sleep(250);
    
                textarea.value = originalValue + line + '\n';
                textarea.scrollTop = textarea.scrollHeight;
                await sleep(50);
            }
        }
    
        stopNotepadEffect(); // Эффект завершен, останавливаем звук
    }

    // Event delegation for window buttons
    document.getElementById('desktop').addEventListener('click', (e) => {
        const target = e.target;

        // Window control buttons
        if (target.classList.contains('close-btn')) {
            closeWindow(target.dataset.windowId);
        }
        if (target.classList.contains('minimize-btn')) {
            minimizeWindow(target.dataset.windowId);
        }
        if (target.classList.contains('maximize-btn')) {
            toggleMaximize(target.dataset.windowId);
        }

        // Accordion logic for all apps
        const header = e.target.closest('.thread-header');
        if (header) {
            const thread = header.parentElement;
            const icon = header.querySelector('.toggle-icon');

            thread.classList.toggle('expanded');

            if (thread.classList.contains('expanded')) {
                icon.textContent = '−';
            } else {
                icon.textContent = '+';
            }
            playSound(SOUNDS.CLICK);
            e.stopPropagation(); // Prevent window focus change if clicking inside
        }
    });

    // Открытие окон из меню "Пуск"
    const menuItems = document.querySelectorAll('.menu-item[data-opens]');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            playSound(SOUNDS.CLICK);
            openWindow(item.getAttribute('data-opens'));
            startMenu.style.display = 'none'; // Закрыть меню "Пуск"
        });
    });

    // Функционал перетаскивания окон (с поддержкой мобильных)
    const windows = document.querySelectorAll('.window');
    windows.forEach(makeDraggable);

    // Focus window on click
    windows.forEach(win => {
        win.addEventListener('mousedown', () => focusWindow(win));
        win.addEventListener('touchstart', () => focusWindow(win), { passive: true });
    });
 
    function makeDraggable(element) {
        const titleBar = element.querySelector('.title-bar');
 
        function onStart(e) {
            // Не начинать перетаскивание при клике на кнопки управления окном
            if (e.target.closest('.buttons')) {
                return;
            }
 
            focusWindow(element);
 
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
 
            const offsetX = clientX - element.offsetLeft;
            const offsetY = clientY - element.offsetTop;
 
            function onMove(e) {
                // Предотвращаем прокрутку страницы во время перетаскивания
                e.preventDefault();
 
                const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
 
                let newX = clientX - offsetX;
                let newY = clientY - offsetY;
 
                // Ограничения, чтобы окно не выходило за пределы "рабочего стола"
                const desktop = document.getElementById('desktop');
                const maxX = desktop.clientWidth - element.offsetWidth;
                const maxY = desktop.clientHeight - element.offsetHeight;
 
                if (newX < 0) newX = 0;
                if (newY < 0) newY = 0;
                if (newX > maxX) newX = maxX;
                if (newY > maxY) newY = maxY;
 
                element.style.left = `${newX}px`;
                element.style.top = `${newY}px`;
            }
 
            function onEnd() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onEnd);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
            }
 
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }
 
        titleBar.addEventListener('mousedown', onStart);
        titleBar.addEventListener('touchstart', onStart, { passive: false });
    }

    // --- Функция для гейм-мастера ---
    function revealUSBContent() {
        const usbFolder = document.getElementById('usb-folder-icon');
        if (usbFolder.style.display !== 'none') {
            console.log('USB content already revealed.');
            return; // Не делать ничего, если контент уже показан
        }

        // Показать иконку папки
        usbFolder.style.display = 'block';

        // Показать уведомление
        playSound(SOUNDS.USB_CONNECT);
        showNotification('<strong>New hardware found:</strong><br>USB Mass Storage Device');

        // "Зарегистрировать" новые иконки внутри папки, чтобы они открывались
        const newIcons = document.querySelectorAll('#usb-folder-window .desktop-icon');
        newIcons.forEach(icon => {
            icon.addEventListener('click', () => {
                playSound(SOUNDS.CLICK);
                openWindow(icon.getAttribute('data-opens'));
            });
            // Make the new image viewer draggable
            if (usbFolder.querySelector('#image-viewer-window')) {
                makeDraggable(document.getElementById('image-viewer-window'));
            }
        });
    }

    // Слушатель для вызова функции гейм-мастером
    document.addEventListener('keydown', (e) => {
        // Нажмите 'U' для активации
        if (e.key.toLowerCase() === 'u') {
            console.log('GM key pressed. Revealing USB content...');
            revealUSBContent();
        }
    });

    // --- Image Viewer Logic ---
    const imageViewer = document.getElementById('image-viewer-window');
    if (imageViewer) {
        const container = imageViewer.querySelector('.image-container');
        const img = container.querySelector('img');
        const zoomInBtn = imageViewer.querySelector('#zoom-in-btn');
        const zoomOutBtn = imageViewer.querySelector('#zoom-out-btn');
        const rotateBtn = imageViewer.querySelector('#rotate-btn');
        const resetBtn = imageViewer.querySelector('#reset-btn');

        let scale = 1;
        let rotation = 0;
        let posX = 0;
        let posY = 0;

        function updateTransform() {
            img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale}) rotate(${rotation}deg)`;
        }

        function reset() {
            scale = 1;
            rotation = 0;
            posX = 0;
            posY = 0;
            updateTransform();
        }

        zoomInBtn.addEventListener('click', () => {
            scale *= 1.2;
            updateTransform();
        });

        zoomOutBtn.addEventListener('click', () => {
            scale /= 1.2;
            updateTransform();
        });

        rotateBtn.addEventListener('click', () => {
            rotation += 90;
            updateTransform();
        });

        resetBtn.addEventListener('click', reset);

        // Drag to pan
        let isPanning = false;
        let startX, startY;

        container.addEventListener('mousedown', (e) => {
            isPanning = true;
            startX = e.clientX - posX;
            startY = e.clientY - posY;
            container.classList.add('grabbing');
        });

        container.addEventListener('mouseup', () => {
            isPanning = false;
            container.classList.remove('grabbing');
        });

        container.addEventListener('mouseleave', () => {
            isPanning = false;
            container.classList.remove('grabbing');
        });

        container.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            posX = e.clientX - startX;
            posY = e.clientY - startY;
            updateTransform();
        });

        // Pinch to zoom for mobile
        let initialDistance = null;

        function getDistance(touches) {
            const [touch1, touch2] = touches;
            return Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
        }

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = getDistance(e.touches);
            } else if (e.touches.length === 1) {
                isPanning = true;
                startX = e.touches[0].clientX - posX;
                startY = e.touches[0].clientY - posY;
            }
        });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && initialDistance) {
                e.preventDefault();
                const newDistance = getDistance(e.touches);
                scale *= newDistance / initialDistance;
                initialDistance = newDistance;
                updateTransform();
            } else if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                posX = e.touches[0].clientX - startX;
                posY = e.touches[0].clientY - startY;
                updateTransform();
            }
        });

        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = null;
            }
            if (e.touches.length < 1) {
                isPanning = false;
            }
        });

        // Reset on window close
        const closeBtn = imageViewer.querySelector('.close-btn');
        closeBtn.addEventListener('click', reset);
    }
});
