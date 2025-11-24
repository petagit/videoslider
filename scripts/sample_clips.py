import os
import subprocess
import random
import sys
import glob

def get_duration(file_path):
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        file_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        print(f"Error getting duration: {result.stderr}")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sample_clips.py <youtube_url> [clip_duration_seconds]")
        sys.exit(1)

    url = sys.argv[1]
    clip_duration = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
    
    output_dir = "public/music-presets/sampled"
    os.makedirs(output_dir, exist_ok=True)
    
    temp_prefix = "temp_source_audio"
    temp_path_pattern = os.path.join(output_dir, temp_prefix + ".*")
    
    # Cleanup previous runs
    for f in glob.glob(temp_path_pattern):
        os.remove(f)

    print(f"Downloading audio from {url}...")
    # Download using yt-dlp
    cmd = [
        'yt-dlp',
        '-x', '--audio-format', 'mp3',
        '-o', os.path.join(output_dir, temp_prefix + ".%(ext)s"),
        url
    ]
    subprocess.run(cmd, check=True)
    
    # Find the downloaded file
    source_files = glob.glob(os.path.join(output_dir, temp_prefix + ".mp3"))
    if not source_files:
        print("Error: Could not find downloaded audio file.")
        sys.exit(1)
    
    source_file = source_files[0]
    duration = get_duration(source_file)
    print(f"Total duration: {duration:.2f} seconds")
    
    num_clips = 30
    
    if duration < clip_duration:
        print("Audio is shorter than the requested clip duration.")
        sys.exit(1)

    # Generate clips
    for i in range(num_clips):
        max_start = duration - clip_duration
        start_time = random.uniform(0, max_start)
        
        # Formatting filename: clip_01.mp3
        output_filename = os.path.join(output_dir, f"clip_{i+1:03d}.mp3")
        
        print(f"[{i+1}/{num_clips}] Generating clip starting at {start_time:.2f}s...")
        
        # Re-encoding is safer for random access cutting to ensure valid files
        ffmpeg_cmd = [
            'ffmpeg',
            '-y',
            '-ss', f"{start_time:.2f}",
            '-i', source_file,
            '-t', f"{clip_duration}",
            '-c:a', 'libmp3lame',
            '-q:a', '2', # High quality VBR
            '-loglevel', 'error',
            output_filename
        ]
        subprocess.run(ffmpeg_cmd)

    print(f"Done! {num_clips} clips saved to {output_dir}")
    
    # Cleanup source file
    os.remove(source_file)
    print("Temporary source file removed.")

if __name__ == "__main__":
    main()

