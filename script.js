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
        statusMessage.textContent = 'Memproses audio... Ini mungkin memakan waktu beberapa saat.';

        const volume = volumeSlider.value / 100;
        
        try {
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
            const wav = bufferToWave(renderedBuffer);
            
            const blob = new Blob([wav], { type: 'audio/mpeg' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;

            const originalName = audioFile.name.replace(/\.[^/.]+$/, ""); // Hapus ekstensi lama
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
    
    // AudioBuffer to wav
    function bufferToWave(abuffer) {
        let numOfChan = abuffer.numberOfChannels,
            length = abuffer.length * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [], i, sample, offset = 0, pos = 0;

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        for (i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        return buffer;

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    }
});
