/**
 * Value Object: ApiKey
 * 
 * Encapsula y valida la API key de Jules, garantizando que siempre
 * se trabaje con un valor válido y no vacío.
 */

export class ApiKey {
    private readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    /**
     * Crea una ApiKey desde un string.
     * @throws {Error} si el valor es vacío o inválido
     */
    static fromString(value: string | undefined): ApiKey {
        if (!value || value.trim().length === 0) {
            throw new Error(
                'La variable de entorno JULES_API_KEY es requerida. ' +
                'Obtén tu API key desde https://jules.google.com/settings#api'
            );
        }
        return new ApiKey(value.trim());
    }

    /**
     * Crea una ApiKey desde las variables de entorno.
     */
    static fromEnv(): ApiKey {
        return ApiKey.fromString(process.env.JULES_API_KEY);
    }

    /**
     * Retorna el valor de la API key.
     */
    toString(): string {
        return this.value;
    }

    /**
     * Compara dos ApiKeys por igualdad de valor.
     */
    equals(other: ApiKey): boolean {
        return this.value === other.value;
    }
}
