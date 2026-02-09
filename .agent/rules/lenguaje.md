---
trigger: always_on
---

# Guía de Build, Testing y Mejora Continua del README

## Objetivo

Establecer un proceso claro y repetible donde **siempre** se realice el build del proyecto, se ejecuten las pruebas correspondientes y, una vez validadas, se **actualice y mejore el README** reflejando fielmente los cambios aplicados.

Esta guía busca:

* Reducir errores en despliegues.
* Asegurar consistencia entre código y documentación.
* Mejorar la calidad y confiabilidad del proyecto.

---

## Idioma del Proyecto (Regla Obligatoria)

* Todas las respuestas, comunicaciones, documentación y comentarios **deben realizarse en español**.
* No se aceptan entregables parcial o totalmente en otros idiomas.
* El README y cualquier documento asociado deben mantenerse exclusivamente en español.

> ✅ **Criterio de aceptación:** cualquier contribución que no cumpla esta regla debe corregirse antes de considerarse finalizada.

---

## Flujo de Trabajo Obligatorio

### 1. Build del Proyecto

Antes de cualquier prueba o documentación:

* Ejecutar el comando de build correspondiente al proyecto.
* Verificar que el proceso finaliza **sin errores**.
* Confirmar que los artefactos generados son correctos.

> ✅ **Criterio de aceptación:** el build debe completarse exitosamente.

---

### 2. Ejecución de Pruebas

Una vez completado el build, se deben ejecutar las pruebas aplicables:

* Pruebas unitarias.
* Pruebas de integración.
* Pruebas end-to-end (si aplica).

Registrar:

* Resultados.
* Cobertura.
* Errores detectados y correcciones aplicadas.

> ✅ **Criterio de aceptación:** todas las pruebas deben pasar o estar justificadas.

---

### 3. Validación de Cambios

Antes de actualizar el README:

* Confirmar que los cambios fueron probados.
* Verificar que no existen regresiones.
* Asegurar que el comportamiento es el esperado.

---

### 4. Mejora y Actualización del README (Obligatorio)

El README **siempre** debe actualizarse tras cambios validados.

Se debe:

* Reflejar nuevas funcionalidades.
* Actualizar instrucciones de build y testing.
* Ajustar ejemplos, comandos y flujos.
* Eliminar información obsoleta.
* Mejorar redacción, claridad y estructura.

Contenido mínimo recomendado:

* Descripción actualizada del proyecto.
* Requisitos.
* Instalación.
* Build del proyecto.
* Ejecución de pruebas.
* Cambios recientes relevantes.

> ✅ **Regla clave:** ningún cambio se considera completo sin README actualizado.

---

## Checklist Final

Antes de cerrar cualquier cambio:

* [ ] Build ejecutado y exitoso
* [ ] Pruebas completadas y validadas
* [ ] Cambios verificados
* [ ] README actualizado y mejorado

---

## Mejora Continua

Este documento debe revisarse periódicamente para:

* Ajustarse a nuevas herramientas o tecnologías.
* Incorporar mejores prácticas.
* Mantener alineado el proceso con la realidad del proyecto.

---

📌 **Conclusión**

El build, las pruebas y la documentación no son pasos opcionales: forman un único ciclo de calidad. Documentar correctamente lo ya probado es parte esencial del desarrollo profesional de software.