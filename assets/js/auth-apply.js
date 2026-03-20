import { auth } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from "../vendor/firebase/firebase-auth.js";
import { apiFetch, uploadImage } from "./api.js?v=20260310b";

const appForm = document.getElementById("appForm");
const appError = document.getElementById("appError");
const loginForm = document.getElementById("loginForm");
const showAppFormBtn = document.getElementById("showAppFormBtn");
const showLoginFormBtn = document.getElementById("showLoginFormBtn");
const startCameraScanBtn = document.getElementById("startCameraScanBtn");
const retakeCameraScanBtn = document.getElementById("retakeCameraScanBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const btnCapture = document.getElementById("btnCapture");

// Camera State
let stream = null;
let photoBlob = null;
let scanTimer = null;
let countdownTimer = null;
let trackerTask = null; // Tracker

// Inject Styles for Scanner
const style = document.createElement('style');
style.innerHTML = `
@keyframes scanMove {
  0% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
.animate-scan { animation: scanMove 2s linear infinite; }
`;
document.head.appendChild(style);

function setApplicationMode(showApplication) {
    if (loginForm) loginForm.style.display = showApplication ? "none" : "block";
    if (appForm) appForm.style.display = showApplication ? "block" : "none";
}

showAppFormBtn?.addEventListener("click", () => {
    setApplicationMode(true);
});

showLoginFormBtn?.addEventListener("click", () => {
    setApplicationMode(false);
});

startCameraScanBtn?.addEventListener("click", () => {
    void window.startCameraScan?.();
});

retakeCameraScanBtn?.addEventListener("click", () => {
    void window.startCameraScan?.();
});

closeCameraBtn?.addEventListener("click", () => {
    window.closeCamera?.();
});

btnCapture?.addEventListener("click", () => {
    window.capturePhoto?.();
});

// Check or Load Libs
async function loadTrackingLib() {
    // Check if SsdMobilenetv1 is loaded
    if (window.faceapi && !window.faceapi.nets.ssdMobilenetv1.params) {
        const MODEL_URL = '../vendor/face-api/models';
        // Load the Heavy Duty Model (SSD MobileNet V1)
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    }
}

window.startCameraScan = async () => {
    const modal = document.getElementById("cameraModal");
    const video = document.getElementById("cameraFeed");
    const status = document.getElementById("scanStatus");
    const cd = document.getElementById("scanCountdown");

    appError.textContent = "";

    try {
        status.textContent = "Cargando Motor IA Neural...";
        status.style.color = "#fff";
        modal.style.display = "flex";

        await loadTrackingLib();

        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            status.textContent = "Buscando rostro (Alta Precisión)...";
            status.style.color = "#4ade80";
            status.style.textShadow = "none";
            cd.style.opacity = "0";
            startFaceTracking(video);
        };

    } catch (err) {
        console.error("Camera error", err);
        alert("Error: " + err.message);
        window.closeCamera(); // Use robust close
    }
};

function startFaceTracking(videoElement) {
    const status = document.getElementById("scanStatus");
    const canvas = document.getElementById("cameraCanvas");

    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";

    const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    let consecutiveFrames = 0;

    status.textContent = "Escaneando...";

    // Run heavier model slightly slower (every 100ms is fine for SSD on desktop, maybe 200ms on mobile)
    trackerTask = setInterval(async () => {
        if (!stream || !trackerTask) return;

        try {
            // Use SsdMobilenetv1Options
            const detection = await faceapi.detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (!detection) {
                status.textContent = "Buscando rostro...";
                status.style.color = "#4ade80";
                consecutiveFrames = 0;
                return;
            }

            const box = detection.box;

            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.strokeRect(box.x, box.y, box.width, box.height); // Debug Box
            ctx.restore();

            const vW = videoElement.videoWidth;
            const vH = videoElement.videoHeight;

            const faceCX = box.x + (box.width / 2);
            const faceCY = box.y + (box.height / 2);

            const videoCX = vW / 2;
            const videoCY = vH / 2;

            // Tolerance 10%
            const tolX = vW * 0.10;
            const tolY = vH * 0.12;

            const isCentered =
                Math.abs(faceCX - videoCX) < tolX &&
                Math.abs(faceCY - videoCY) < tolY;

            const isClose = box.width > (vW * 0.15);

            if (isCentered && isClose) {
                consecutiveFrames++;
                status.textContent = "MANTENLO AHÍ 🫡 " + Math.floor((consecutiveFrames / 5) * 100) + "%";
                status.style.color = "#fbbf24";

                if (consecutiveFrames > 5) {
                    clearInterval(trackerTask);
                    trackerTask = null;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    status.textContent = "¡CAPTURA INMINENTE!";
                    status.style.color = "#fff";
                    startCountdown();
                }
            } else {
                consecutiveFrames = 0;
                if (!isClose) status.textContent = "Acércate más...";
                else status.textContent = "Centra tu rostro...";
                status.style.color = "#f87171";
            }
        } catch (e) {
            console.error("Detection error loop", e);
        }

    }, 100);
}

function startCountdown() {
    const cd = document.getElementById("scanCountdown");
    let count = 3;
    const runCount = () => {
        if (count > 0) {
            cd.textContent = count;
            cd.style.opacity = "1";
            cd.style.transform = "scale(1)";
            // Faster animation
            setTimeout(() => { cd.style.transform = "scale(0.8)"; cd.style.opacity = "0.5"; }, 250);
            count--;
            // Super fast steps (300ms instead of 1000ms)
            countdownTimer = setTimeout(runCount, 300);
        } else {
            capturePhoto();
        }
    };
    runCount();
}

window.closeCamera = () => {
    const modal = document.getElementById("cameraModal");
    const video = document.getElementById("cameraFeed");

    // Clear Automation
    if (trackerTask) {
        clearInterval(trackerTask);
        trackerTask = null;
    }
    clearTimeout(scanTimer);
    clearTimeout(countdownTimer);

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    modal.style.display = "none";
};

window.capturePhoto = () => {
    const video = document.getElementById("cameraFeed");
    const canvas = document.getElementById("cameraCanvas");
    const preview = document.getElementById("scanResult");
    const defaults = document.getElementById("scanPreview");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    // Mirror the capture if using front camera logic (transform scale-x -1 in CSS)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        photoBlob = blob;
        preview.src = URL.createObjectURL(blob);
        defaults.classList.remove("hidden");
        // Hide button, show retake logic handled by HTML
        closeCamera();
    }, 'image/jpeg', 0.8);
};

async function submitApp(name, email, phone, address, photoUrl, token) {
    await apiFetch("/employee/applications", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, displayName: name, email, phone, address, photoUrl })
    });
}

if (appForm) {
    appForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        appError.textContent = "";

        const name = document.getElementById("appName").value.trim();
        const address = document.getElementById("appAddress").value.trim();
        const email = document.getElementById("appEmail").value.trim();
        const phone = document.getElementById("appPhone").value.trim();
        const pass = document.getElementById("appPass").value;

        if (!photoBlob) {
            appError.textContent = "Debes realizar el escaneo facial.";
            return;
        }

        if (!address) {
            appError.textContent = "La dirección es obligatoria.";
            return;
        }

        const btn = appForm.querySelector("button[type='submit']");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "ENVIANDO...";

        try {
            // 1. Authenticate FIRST (Create or Login)
            btn.textContent = "CREANDO CUENTA...";
            let user;
            try {
                // Try Create Account
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                user = userCred.user;
            } catch (createErr) {
                if (createErr.code === "auth/email-already-in-use") {
                    // Fallback: Try Login
                    btn.textContent = "INICIANDO SESIÓN...";
                    const loginCred = await signInWithEmailAndPassword(auth, email, pass);
                    user = loginCred.user;
                } else {
                    throw createErr;
                }
            }

            // 2. Now Upload Selfie (Authenticated)
            let photoUrl = "";
            try {
                btn.textContent = "SUBIENDO FOTO...";
                // Create File from Blob
                const file = new File([photoBlob], "selfie_scan.jpg", { type: "image/jpeg" });
                const uploadRes = await uploadImage(file);
                photoUrl = uploadRes.url;
            } catch (ulErr) {
                throw new Error("Error subiendo foto: " + ulErr.message);
            }

            // 3. Update Profile Name + Photo
            try {
                await updateProfile(user, { displayName: name, photoURL: photoUrl });
            } catch (_) {
                console.warn("Could not update firebase profile", _);
            }

            // 4. Submit Application to Backend
            btn.textContent = "REGISTRANDO...";
            const token = await user.getIdToken(true);
            await submitApp(name, email, phone, address, photoUrl, token);

            // 5. Success feedback
            alert("✅ Solicitud enviada correctamente.\n\nEl jefe revisará tu perfil. Podrás entrar cuando seas aprobado.");

            // 6. Sign out
            await signOut(auth);

            // 7. Reset UI
            appForm.reset();
            photoBlob = null;
            document.getElementById("scanPreview").classList.add("hidden");
            document.getElementById('appForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';

        } catch (err) {
            console.error(err);
            let msg = "Error al enviar solicitud.";
            if (err.code === "auth/unauthorized-domain") {
                msg = `Dominio no autorizado en Firebase (${window.location.hostname}). Agrega este dominio en Firebase Console.`;
            } else if (err.code === "auth/operation-not-allowed") {
                msg = "Proveedor de autenticacion deshabilitado en Firebase.";
            } else if (err.code === "auth/network-request-failed") {
                msg = "Error de red al conectar con Firebase.";
            } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
                msg = "El email ya existe pero la contraseña es incorrecta.";
            } else if (err.status) {
                msg = `Error del servidor: ${err.message}`;
            } else {
                msg = err.message || msg;
            }

            appError.textContent = msg;
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}
