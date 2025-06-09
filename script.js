document.addEventListener('DOMContentLoaded', () => {
    const audioFileInput = document.getElementById('audio-file');
    const fileNameDisplay = document.getElementById('file-name');
    const controlsSection = document.getElementById('controls');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValueDisplay = document.getElementById('volume-value');
    const downloadBtn = document.getElementById('download-btn');
    const statusMessage = document.getElementById('status-message');

    let audioFile = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffer = null;

    audioFileInput.addEventListener('change', (event) => {
        audioFile = event.target.files[0];
        if (audioFile) {
            fileNameDisplay.textContent = audioFile.name;
            controlsSection.classList.remove('hidden');
            statusMessage.textContent = 'Membaca file...';
            downloadBtn.disabled = true;

            const reader = new FileReader();
            reader.onload = (e) => {
                audioContext.decodeAudioData(e.target.result, (buffer) => {
                    audioBuffer = buffer;
                    downloadBtn.disabled = false;
                    statusMessage.textContent = 'File siap diproses.';
                }, (error) => {
                    statusMessage.textContent = 'Gagal memproses file audio. Coba file lain.';
                    console.error('Error decoding audio data:', error);
                });
            };
            reader.readAsArrayBuffer(audioFile);
        }
    });

    volumeSlider.addEventListener('input', () => {
        volumeValueDisplay.textContent = `${volumeSlider.value}%`;
    });

    downloadBtn.addEventListener('click', async () => {
        if (!audioBuffer) {
            statusMessage.textContent = 'Silakan tunggu audio selesai dimuat.';
            return;
        }

        downloadBtn.disabled = true;
        statusMessage.textContent = 'Memproses audio... Ini mungkin memakan waktu agak lama.';

        try {
            // kurva volume eksponensial
            const sliderValue = volumeSlider.value / 100;
            const volume = Math.pow(sliderValue, 2); 

            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = offlineContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(offlineContext.destination);
            source.start();

            const renderedBuffer = await offlineContext.startRendering();
            
            // encode ke mp3
            const mp3Blob = encodeToMp3(renderedBuffer);

            const url = URL.createObjectURL(mp3Blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            const originalName = audioFile.name.replace(/\.[^/.]+$/, "");
            const newFileName = `${originalName}_${volumeSlider.value}x.mp3`;
            a.download = newFileName;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            statusMessage.textContent = 'Audio berhasil diproses dan diunduh!';
        } catch (error) {
            console.error('Error processing audio:', error);
            statusMessage.textContent = 'Terjadi kesalahan saat memproses audio.';
        } finally {
            downloadBtn.disabled = false;
        }
    });
    
    // encode to mp3 using lamejs
    function encodeToMp3(audioBuffer) {
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128); // 128kbps bitrate
        const mp3Data = [];

        const samples = new Int16Array(audioBuffer.getChannelData(0).length);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.max(-1, Math.min(1, audioBuffer.getChannelData(0)[i])) * 32767;
        }

        let left, right;
        if (channels === 2) {
            left = new Int16Array(audioBuffer.getChannelData(0).length);
            right = new Int16Array(audioBuffer.getChannelData(1).length);
            for (let i = 0; i < audioBuffer.length; i++) {
                left[i] = Math.max(-1, Math.min(1, audioBuffer.getChannelData(0)[i])) * 32767;
                right[i] = Math.max(-1, Math.min(1, audioBuffer.getChannelData(1)[i])) * 32767;
            }
        } else { // Mono
            left = samples;
        }

        const bufferSize = 1152;
        for (let i = 0; i < samples.length; i += bufferSize) {
            const leftChunk = left.subarray(i, i + bufferSize);
            let rightChunk = null;
            if (channels === 2) {
                rightChunk = right.subarray(i, i + bufferSize);
            }
            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        return new Blob(mp3Data, { type: 'audio/mpeg' });
    }
});
