/**
 * ============================================================================
 * QUANTUM DOWNLOADER ENGINE - SERVER.JS (YOUTUBE + TIKTOK + INSTAGRAM + STORIES)
 * ============================================================================
 */

const express = require('express');
const youtubedl = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const https = require('https');

// Inicialização da aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Middleware global de log para rastreamento de requisições
 */
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

/**
 * Função utilitária para gerar diretórios temporários únicos
 */
function gerarDiretorioTemporario() {
    const hashUnico = crypto.randomBytes(8).toString('hex');
    const dirTemp = path.join(os.tmpdir(), `quantum-dl-${Date.now()}-${hashUnico}`);
    try {
        fs.mkdirSync(dirTemp, { recursive: true });
        return dirTemp;
    } catch (err) {
        console.error('Erro crítico ao criar diretório temporário:', err);
        throw new Error('Falha ao alocar espaço temporário para processamento.');
    }
}

/**
 * Função utilitária para limpeza segura de diretórios temporários
 */
function limparDiretorioTemporario(caminhoDir) {
    if (!caminhoDir) return;
    try {
        if (fs.existsSync(caminhoDir)) {
            fs.rmSync(caminhoDir, { recursive: true, force: true });
            console.log(`[Limpeza] Diretório temporário removido: ${caminhoDir}`);
        }
    } catch (err) {
        console.warn(`[Aviso] Falha menor ao limpar diretório ${caminhoDir}:`, err.message);
    }
}

/**
 * Função auxiliar para requisições HTTPS GET (Retorna JSON)
 */
function requisicaoHttpsGet(urlApi) {
    return new Promise((resolve, reject) => {
        https.get(urlApi, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let dados = '';
            res.on('data', (chunk) => { dados += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(dados));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => { reject(err); });
    });
}

/**
 * Função auxiliar para baixar arquivos via URL direta (TikTok)
 */
function baixarArquivoDireto(urlVideo, caminhoDestino) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(caminhoDestino);
        https.get(urlVideo, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Falha no download direto, status code: ${res.statusCode}`));
                return;
            }
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(caminhoDestino);
            });
        }).on('error', (err) => {
            fs.unlink(caminhoDestino, () => {});
            reject(err);
        });
    });
}

/**
 * Pós-processamento Ultra-Rápido para remover HEVC do TikTok (preset ultrafast)
 */
function converterTikTokParaH264(arquivoEntrada, diretorioTemp) {
    const extOriginal = path.extname(arquivoEntrada);
    const nomeBase = path.basename(arquivoEntrada, extOriginal);
    const arquivoSaida = path.join(diretorioTemp, `${nomeBase}_universal.mp4`);

    console.log(`[FFmpeg TikTok] Convertendo HEVC instantaneamente para H.264: ${nomeBase}`);

    try {
        const comandoFfmpeg = `"${ffmpegPath}" -y -i "${arquivoEntrada}" -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -c:a aac "${arquivoSaida}"`;
        execSync(comandoFfmpeg, { stdio: 'ignore' });

        if (fs.existsSync(arquivoSaida)) {
            console.log(`[FFmpeg TikTok] Conversão concluída com sucesso!`);
            return arquivoSaida;
        }
        return arquivoEntrada;
    } catch (err) {
        console.warn('[Aviso FFmpeg TikTok] Falha na conversão ultrafast, usando original:', err.message);
        return arquivoEntrada;
    }
}

/**
 * Rota de Health Check
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ONLINE',
        uptime: process.uptime(),
        timestamp: Date.now(),
        ffmpeg: fs.existsSync(ffmpegPath) ? 'Disponível' : 'Indisponível'
    });
});

/**
 * ============================================================================
 * ROTA DE ANÁLISE DE MÍDIA (/api/analisar)
 * ============================================================================
 */
app.post('/api/analisar', async (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL inválida ou não informada.' });
    }

    const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok.com');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isInstagram = url.includes('instagram.com');

    let responseData = {
        title: isTikTok ? 'Vídeo do TikTok' : (isYouTube ? 'Vídeo do YouTube' : (isInstagram ? 'Mídia do Instagram (Reel/Post/Story)' : 'Mídia Detectada')),
        thumbnail: 'https://via.placeholder.com/320x180?text=Quantum+DL',
        type: 'VÍDEO',
        platform: isTikTok ? 'tiktok' : (isYouTube ? 'youtube' : (isInstagram ? 'instagram' : 'outro')),
        downloadUrl: url
    };

    try {
        if (isTikTok) {
            console.log(`[Análise TikTok] Consultando API TikWM para: ${url}`);
            const apiRes = await requisicaoHttpsGet(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            if (apiRes && apiRes.code === 0 && apiRes.data) {
                if (apiRes.data.title) responseData.title = apiRes.data.title;
                if (apiRes.data.cover) responseData.thumbnail = apiRes.data.cover;
            }
        } else {
            let argsAnalise = {
                dumpSingleJson: true,
                noWarnings: true,
                ignoreErrors: true,
                noCheckCertificates: true,
                skipDownload: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            };

            // Se existir o arquivo cookies.txt na raiz, utiliza ele para evitar erros de autenticação em Stories
            const caminhoCookies = path.join(__dirname, 'cookies.txt');
            if (fs.existsSync(caminhoCookies)) {
                argsAnalise.cookies = caminhoCookies;
            }

            const infoMetadados = await youtubedl(url, argsAnalise);
            if (infoMetadados) {
                if (infoMetadados.title) responseData.title = infoMetadados.title;
                if (infoMetadados.thumbnail) {
                    responseData.thumbnail = infoMetadados.thumbnail;
                } else if (infoMetadados.thumbnails && infoMetadados.thumbnails.length > 0) {
                    responseData.thumbnail = infoMetadados.thumbnails[infoMetadados.thumbnails.length - 1].url;
                }
            }
        }
    } catch (erroAnalise) {
        console.warn('[Aviso de Análise] Falha na extração, aplicando fallbacks:', erroAnalise.message);
        if (isTikTok) {
            responseData.title = 'Vídeo do TikTok';
            responseData.thumbnail = 'https://via.placeholder.com/320x180?text=TikTok+Media';
        } else if (isInstagram) {
            responseData.title = 'Story / Post do Instagram';
            responseData.thumbnail = 'https://via.placeholder.com/320x180?text=Instagram+Media';
        }
    }

    return res.json(responseData);
});

/**
 * ============================================================================
 * ROTA DE DOWNLOAD (/api/download)
 * ============================================================================
 */
app.get('/api/download', async (req, res) => {
    let { url, formato } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).send('Parâmetro URL obrigatório ausente.');
    }

    const isMp3 = formato && formato.startsWith('mp3');
    const qualidadeSelecionada = formato ? formato.split('-')[1] || '1080' : '1080';
    const diretorioTemp = gerarDiretorioTemporario();

    const isTikTok = url.includes('tiktok.com') || url.includes('vm.tiktok.com');
    const isInstagram = url.includes('instagram.com');

    console.log(`[Download Iniciado] URL: ${url} | Formato: ${formato || 'video-1080'} | Pasta: ${diretorioTemp}`);

    try {
        let caminhoArquivoCompleto = '';

        if (isTikTok && !isMp3) {
            console.log('[Perfil TikTok] Utilizando extrator direto TikWM...');
            const apiRes = await requisicaoHttpsGet(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
            
            if (!apiRes || apiRes.code !== 0 || !apiRes.data || !apiRes.data.play) {
                throw new Error('Não foi possível obter o link direto do vídeo do TikTok.');
            }

            const videoUrlDireto = apiRes.data.play;
            const nomeSeguro = (apiRes.data.title || 'tiktok-video').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            const arquivoBruto = path.join(diretorioTemp, `${nomeSeguro}.mp4`);

            console.log('[TikTok] Baixando stream direto...');
            await baixarArquivoDireto(videoUrlDireto, arquivoBruto);
            caminhoArquivoCompleto = arquivoBruto;

            caminhoArquivoCompleto = converterTikTokParaH264(caminhoArquivoCompleto, diretorioTemp);

        } else {
            let opcoesDownload = {
                output: path.join(diretorioTemp, '%(title)s.%(ext)s'),
                ffmpegLocation: ffmpegPath,
                noWarnings: true,
                ignoreErrors: true,
                noCheckCertificates: true,
                preferFreeFormats: false,
                mergeOutputFormat: 'mp4',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            };

            // Se o arquivo cookies.txt existir na pasta, injeta ele no yt-dlp para autenticar Stories do Instagram
            const caminhoCookies = path.join(__dirname, 'cookies.txt');
            if (fs.existsSync(caminhoCookies)) {
                opcoesDownload.cookies = caminhoCookies;
            }

            if (isMp3) {
                opcoesDownload.extractAudio = true;
                opcoesDownload.audioFormat = 'mp3';
                opcoesDownload.audioQuality = qualidadeSelecionada === '320' ? '320K' : '192K';
                opcoesDownload.format = 'bestaudio/best';
                console.log('[Perfil] Configurado para extração de Áudio MP3');
            } else if (isInstagram) {
                opcoesDownload.format = 'best/best';
                console.log('[Perfil] Configurado para Mídia Instagram (Reels/Post/Story)');
            } else {
                opcoesDownload.format = `bestvideo[vcodec^=avc][height<=${qualidadeSelecionada}]+bestaudio[ext=m4a]/\
bestvideo[vcodec^=avc][height<=${qualidadeSelecionada}]+bestaudio/\
best[height<=${qualidadeSelecionada}][ext=mp4]/\
best[height<=${qualidadeSelecionada}]/best`;
                console.log(`[Perfil] Configurado para Vídeo YouTube H.264 Direto até ${qualidadeSelecionada}p`);
            }

            await youtubedl(url, opcoesDownload);

            if (!fs.existsSync(diretorioTemp)) {
                throw new Error('Diretório temporário desapareceu durante o download.');
            }

            let arquivosBaixados = fs.readdirSync(diretorioTemp);
            if (arquivosBaixados.length === 0) {
                throw new Error('Nenhum arquivo de mídia foi gerado.');
            }

            caminhoArquivoCompleto = path.join(diretorioTemp, arquivosBaixados[0]);
        }

        const nomeArquivoFinal = path.basename(caminhoArquivoCompleto);
        console.log(`[Download Concluído] Enviando arquivo: ${nomeArquivoFinal}`);

        res.download(caminhoArquivoCompleto, nomeArquivoFinal, (erroEnvio) => {
            if (erroEnvio) {
                console.error('[Erro de Envio] Falha ao transmitir arquivo:', erroEnvio);
            }
            limparDiretorioTemporario(diretorioTemp);
        });

    } catch (erroGeralDownload) {
        console.error('[Erro Crítico no Download]:', erroGeralDownload);
        limparDiretorioTemporario(diretorioTemp);

        if (!res.headersSent) {
            res.status(500).send('Erro interno ao processar e baixar o arquivo de mídia. Verifique se o link é público ou se o arquivo cookies.txt está na raiz para baixar Stories.');
        }
    }
});

/**
 * Rota coringa 404
 */
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
});

/**
 * Inicialização do servidor
 */
app.listen(PORT, () => {
    console.log('============================================================');
    console.log(`🚀 Quantum DL Server rodando com sucesso na porta ${PORT}`);
    console.log(`📂 Caminho do FFmpeg estático integrado: ${ffmpegPath}`);
    console.log('============================================================');
});
