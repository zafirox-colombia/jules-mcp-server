
import { JulesDurableObject } from './durable_object.js';

export interface Env {
    JULES_DO: DurableObjectNamespace;
    JULES_API_KEY: string;
}

// Exportar la clase Durable Object para que el runtime la detecte
export { JulesDurableObject };

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // Usar un nombre fijo "default" para crear un Singleton.
        // Todas las conexiones irán a la misma instancia de la clase.
        const id = env.JULES_DO.idFromName("default");
        const stub = env.JULES_DO.get(id);

        // Reenviar la petición al Durable Object
        return stub.fetch(request);
    }
};
