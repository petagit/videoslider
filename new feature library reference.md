For a Next.js project, the best “library” approach for turning images (like slides) into a real video is:

1. Remotion (recommended)

What it is:
A React-based video creation framework. You build your “slides” as React components (can look exactly like a PowerPoint/Keynote deck), and Remotion renders them to MP4.

Why it fits your use case:
	•	Works great with React/Next.js mental model.
	•	Can animate transitions, text, overlays, etc. using React props and hooks.
	•	You control timing: e.g. 3 seconds per image, 30 FPS, etc.
	•	Can be run via CLI or server-side to generate the video.

How you’d use it conceptually:
	1.	Create a Remotion project (they have a template CLI).
	2.	Build a <SlideShow> component that:
	•	Takes an array of image URLs.
	•	Uses frame index (useCurrentFrame()) & FPS to know which slide to show.
	3.	Export a composition (e.g. 1920×1080, 30 fps).
	4.	Trigger rendering from Node (or as a separate script your Next.js app can call).

You’d keep Remotion as a separate “video renderer” package and call it from your Next.js backend/API route if needed.

⸻

2. If you want more low-level / DIY

If you don’t want Remotion and prefer something closer to “take N images and turn into video”:
	•	ffmpeg.wasm (client or server)
Use FFmpeg compiled to WebAssembly:
	•	Show slideshow in-browser with a simple React/Next component.
	•	Capture a sequence of frames (canvas or WebRTC capture).
	•	Use ffmpeg.wasm to encode images → MP4.
	•	Node + ffmpeg (recommended for backend)
From a Next.js API route:
	1.	Upload images.
	2.	Use fluent-ffmpeg + system FFmpeg to stitch: