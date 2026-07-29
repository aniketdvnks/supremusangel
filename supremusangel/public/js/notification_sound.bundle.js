(() => {
	const SOUND_NAME = "alert";
	const SOUND_COOLDOWN_MS = 2000;

	let last_played_at = 0;

	function get_sound() {
		return document.getElementById(`sound-${SOUND_NAME}`);
	}

	function play_notification_sound() {
		const now = Date.now();
		if (now - last_played_at < SOUND_COOLDOWN_MS) {
			return;
		}

		if (frappe.boot?.user?.mute_sounds) {
			return;
		}

		const audio = get_sound();
		if (!audio) {
			return;
		}

		last_played_at = now;

		try {
			audio.volume = Number(audio.getAttribute("volume")) || 1;
			if (!audio.paused) {
				audio.currentTime = 0;
			}

			const play = audio.play();
			if (play && typeof play.catch === "function") {
				play.catch(() => {
					// Autoplay may be blocked until the user interacts with Desk.
				});
			}
		} catch (e) {
			// Sound support should never interrupt Frappe's notification UI.
		}
	}

	$(document).on("app_ready", () => {
		if (!frappe.realtime?.on) {
			return;
		}

		frappe.realtime.on("notification", play_notification_sound);
	});
})();
