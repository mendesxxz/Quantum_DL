let currentPlatform = 'youtube';
let isPlaylistDetected = false;

function setPlatform(plat, btn) {
    currentPlatform = plat;
    document.querySelectorAll('.plat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const input = document.getElementById('urlInput');
    const qualityWrapper = document.getElementById('qualityWrapper');
    qualityWrapper.style.display = 'block';

    if (plat === 'youtube') {
        input.placeholder = "Cole o link do YouTube ou Playlist aqui...";
    } else if (plat === 'tiktok') {
        input.placeholder = "Cole o link do TikTok aqui...";
    } else if (plat === 'instagram') {
        input.placeholder = "Cole o link do Reels/Post do Instagram aqui...";
    }
}

async function fetchMediaInfo() {
    const url = document.getElementById('urlInput').value.trim();
    const statusBox = document.getElementById('statusBox');

    if (!url) {
        showStatus('Por favor, insira um link válido antes de continuar.', 'error');
        return;
    }

    showStatus('Analisando link na Quantum Cloud...', 'loading');

    try {
        const response = await fetch('/api/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, plataforma: currentPlatform })
        });

        const data = await response.json();

        if (response.ok) {
            statusBox.classList.add('hidden');
            document.getElementById('inputSection').classList.add('hidden');
            document.getElementById('previewSection').classList.remove('hidden');

            document.getElementById('mediaThumb').src = data.thumbnail || 'https://via.placeholder.com/130x75?text=Quantum';
            document.getElementById('mediaTitle').innerText = data.title || 'Mídia Carregada com Sucesso';
            document.getElementById('mediaTypeBadge').innerText = data.type || 'Mídia Pronta';
            
            window.extractedMediaUrl = data.downloadUrl;
            isPlaylistDetected = data.isPlaylist;

            if (isPlaylistDetected) {
                showStatus('⚠️ Aviso: Playlist detectada! O arquivo será compactado em .ZIP e o download pode demorar alguns minutos.', 'error');
                statusBox.classList.remove('hidden');
            }
        } else {
            showStatus(data.error || 'Não foi possível extrair a mídia.', 'error');
        }
    } catch (err) {
        showStatus('Erro de comunicação com o servidor.', 'error');
    }
}

function startDownload() {
    const format = document.getElementById('qualitySelect').value;
    const statusBox = document.getElementById('statusBox');

    if (!window.extractedMediaUrl) {
        showStatus('Nenhum link processado.', 'error');
        return;
    }

    if (isPlaylistDetected) {
        showStatus('Gerando e compactando playlist inteira em .ZIP... Isso pode demorar!', 'loading');
    } else {
        showStatus('Baixando e convertendo arquivo em alta qualidade...', 'loading');
    }
    
    const downloadUrl = `/api/download?url=${encodeURIComponent(window.extractedMediaUrl)}&formato=${format}&isPlaylist=${isPlaylistDetected}`;
    
    setTimeout(() => {
        const a = document.createElement('a');
        a.href = downloadUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showStatus('Download concluído com sucesso!', 'success');
    }, 1000);
}

function resetForm() {
    document.getElementById('urlInput').value = '';
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('inputSection').classList.remove('hidden');
    document.getElementById('statusBox').classList.add('hidden');
    window.extractedMediaUrl = null;
    isPlaylistDetected = false;
}

function showStatus(msg, type) {
    const box = document.getElementById('statusBox');
    box.className = `status ${type}`;
    box.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-spinner fa-spin'}"></i> ${msg}`;
    box.classList.remove('hidden');
}