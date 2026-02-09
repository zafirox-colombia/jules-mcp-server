declare module 'express' {
    import { IncomingMessage, ServerResponse } from 'http';

    interface Request extends IncomingMessage {
        query: any;
        body: any;
        params: any;
        path: string;
        url: string;
    }

    interface Response extends ServerResponse {
        json(data: any): this;
        status(code: number): this;
        send(body: any): this;
    }

    interface Application {
        get(path: string, handler: (req: Request, res: Response) => void): void;
        post(path: string, handler: (req: Request, res: Response) => void): void;
        listen(port: number | string, callback?: () => void): void;
        locals: Record<string, any>;
    }

    function express(): Application;
    export = express;
}
