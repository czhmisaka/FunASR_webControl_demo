const startRecording = async () => {
    try {
        status.value = "recording";
        isRecording.value = true;

        // 初始化 AudioContext 并处理可能的挂起状态
        audioContext = new AudioContext();
        console.log("Initial AudioContext state:", audioContext.state);

        // 处理 AudioContext 挂起状态
        if (audioContext.state === "suspended") {
            console.log("AudioContext is suspended, attempting to resume...");
            await audioContext
                .resume()
                .then(() => {
                    console.log("AudioContext resumed successfully");
                })
                .catch((err) => {
                    console.error("Failed to resume AudioContext:", err);
                    throw new Error("无法启动音频上下文");
                });
        }

        // 创建 WebSocket 连接并添加详细状态监控
        ws = new WebSocket("ws://127.0.0.1:10096");

        // 添加 WebSocket 状态监控
        const wsStateMonitor = setInterval(() => { }, 1000);

        ws.onopen = () => {
            clearInterval(wsStateMonitor);

            const config = {
                chunk_size: [5, 10, 5],
                wav_name: "h5",
                is_speaking: true,
                chunk_interval: 10,
                mode: "2pass",
            };

            try {
                ws?.send(JSON.stringify(config));
                console.log("WebSocket config sent:", config);
            } catch (err) {
                console.error("Failed to send WebSocket config:", err);
                throw new Error("无法发送WebSocket配置");
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.mode == "2pass-online")
                    if (data.text) {
                        recognitionResult.value += data.text;
                    }
                if (data.mode == "2pass-offline") {
                    if (data.text) {
                        recognitionResult.value = data.text;
                        handleAssistantResponse(data.text);
                    }
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            status.value = "error";
            // 尝试重新连接
            setTimeout(() => {
                console.log("Attempting WebSocket reconnection...");
                ws = new WebSocket("ws://127.0.0.1:10096");
            }, 3000);
        };

        // 初始化 Recorder
        // @ts-ignore
        recorder = window.Recorder({
            type: "pcm",
            bitRate: 16,
            sampleRate: 16000,
            // @ts-ignore
            onProcess: (buffers, powerLevel, duration, sampleRate) => {
                // 检查 AudioContext 状态
                if (!audioContext || audioContext.state !== "running") {
                    console.error("AudioContext is not running:", audioContext?.state);
                    if (audioContext) {
                        audioContext.resume().catch((err) => {
                            console.error("Failed to resume AudioContext:", err);
                        });
                    }
                    return;
                }

                if (ws && ws.readyState === WebSocket.OPEN) {
                    try {
                        // 转换采样率 48k -> 16k
                        const data_48k = buffers[buffers.length - 1];
                        const array_48k = new Array(data_48k);
                        const data_16k = Recorder.SampleData(
                            array_48k,
                            sampleRate,
                            16000
                        ).data;

                        // 检查转换后的数据
                        if (data_16k.length === 0) {
                            console.error("Empty data after sample rate conversion!");
                            return;
                        }

                        // 发送音频数据
                        ws.send(new Int16Array(data_16k));
                    } catch (err) {
                        console.error("Error processing audio data:", err);
                    }
                } else {
                    console.error("WebSocket not ready:", ws?.readyState);
                }
            },
        });

        // 开始录音
        recorder.open(
            () => {
                recorder.start();
            },
            (err: Error) => {
                console.error("录音启动失败:", err);
                status.value = "error";
            }
        );
    } catch (error) {
        console.error("录音初始化失败:", error);
        status.value = "error";
    }
};

let stopRecording = () => {
    if (recorder) {
        recorder.stop();
        try {
            recorder.stream
                .getTracks()
                .forEach((track: MediaStreamTrack) => track.stop());
        } catch (error) { }
        recorder = null;
    }

    if (ws) {
        ws.close();
        ws = null;
    }

    status.value = "closed";
    isRecording.value = false;
    recognitionResult.value = ""; // 清除识别结果
};