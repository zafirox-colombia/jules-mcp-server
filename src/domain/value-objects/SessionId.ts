/**
 * Value Object: SessionId
 * 
 * Encapsula el ID de sesión de Jules, manejando la normalización
 * del formato (eliminar prefijo 'sessions/' si existe).
 */

export class SessionId {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    /**
     * Crea un SessionId desde un string, normalizando el formato.
     * Elimina el prefijo 'sessions/' si existe.
     * @throws {Error} si el ID es vacío o inválido
     */
    static fromString(id: string): SessionId {
        if (!id || id.trim().length === 0) {
            throw new Error('SessionId no puede estar vacío');
        }

        let cleaned = id.trim();

        // Eliminar prefijo 'sessions/' si existe
        if (cleaned.startsWith('sessions/')) {
            cleaned = cleaned.split('/')[1];
        }

        if (!cleaned) {
            throw new Error('SessionId inválido después de limpiar');
        }

        return new SessionId(cleaned);
    }

    /**
     * Retorna el ID limpio (sin prefijo).
     */
    toString(): string {
        return this.value;
    }

    /**
     * Retorna el ID con el prefijo 'sessions/' para usar en rutas de API.
     */
    toApiPath(): string {
        return `sessions/${this.value}`;
    }

    /**
     * Compara dos SessionIds por igualdad de valor.
     */
    equals(other: SessionId): boolean {
        return this.value === other.value;
    }
}
