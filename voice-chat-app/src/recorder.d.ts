/*
 * @Date: 2025-06-02 19:58:26
 * @LastEditors: CZH
 * @LastEditTime: 2025-06-02 20:57:43
 * @FilePath: /AI编程与MCP使用/voice-chat-app/src/recorder.d.ts
 */
declare module 'recorder-core' {
    interface RecorderConfig {
        type: string;
        bitRate: number;
        sampleRate: number;
        onProcess: (
            buffers: any[],
            powerLevel: number,
            duration: number,
            sampleRate: number
        ) => void;
    }

    interface RecorderInstance {
        open: (success: () => void, fail: (err: Error) => void) => void;
        start: () => void;
        stop: () => void;
        close: () => void;
        stream: MediaStream;
    }

    const Recorder: {
        (config: RecorderConfig): RecorderInstance;
        SampleData: (data: any, fromSampleRate: number, toSampleRate: number) => { data: any };
        Support: () => boolean;
    };

    export default Recorder;
}
