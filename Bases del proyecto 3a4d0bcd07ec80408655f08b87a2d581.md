# Bases del proyecto

Estado: Backlog

- [ ]  Levantar primeros requerimientos funcionales y definir problemática a solucionar.

# DIGITALIZADOS DE DOCUMENTOS

Trabajo hace ya 3 años como juez de bolos y auxiliar de eventos deportivos en una empresa tercerizada por la caja de compensación COMPENSAR aquí en Colombia. Con el pasar de los años, he evidenciado que en la empresa manejamos muchos procesos en papel que hacen la tarea de los coordinadores de los eventos (que son mis compañeros de trabajo diario) más difícil, debido a que tienen que cargar la información en sistemas, transcribirla o guardar archivos PDF de escáneres que son a veces ilegibles por la caligrafía de cada trabajador, haciendo que tarden horas de trabajo en completar un evento. Yo desarrollé hace tiempo, con JavaScript y la suite de Google, una pequeña app que utiliza OCR para poder escanear mis PDF de los eventos y así extraer información legible dentro del cuerpo de un correo electrónico y que se enviara automáticamente.

Mi aplicación lo que hará es tomar una plantilla cargada por el usuario para luego escanear un documento físico de dicha plantilla y, tras haber indicado a la app de qué forma está segmentado el documento, introducir la información requerida en la plantilla digital y generar un documento PDF del mismo documento físico que acabo de escanear, completamente legible, o para poder extraer información precisa del documento y registrarla en una plantilla de Excel.

## **RQF 01 - Escanear documentos dentro de la aplicacion**

| Requerimiento funcional N° | RQF01 |
| --- | --- |
| Nombre | **Escanear documentos dentro de la aplicacion** |
| Tipo | Funcional |
| Prioridad | Alta |
| Descripción | Yo como usuario del sistema quiero poder escanear documentos físicos dentro de la aplicación con la cámara de mi teléfono. |
| Casos de Uso |   • El sistema permitira utilizar la camara del dispositivo que se use para escanear documentos.
  • El sistema permitira escanear un documento.
  • El sistema permitira almacenar temporalmente un documento en formato PDF. |

## **RQF 02 - Digitalizar documentos**

| Requerimiento funcional N° | RQF02 |
| --- | --- |
| Nombre | **Digitalizar documentos** |
| Tipo | Funcional |
| Prioridad | Alta |
| Descripción | Yo como usuario del sistema quiero poder ver mi documento escaneado en formato digital legible y usando la estructura de una plantilla que yo proporciono. |
| Casos de Uso |   • El sistema permitira cargar plantillas en formato PDF de documentos.
  • El sistema permitira cargar plantillas en formato XLSX de documentos.
  • El sistema permitirá seccionar el documento en partes para poder llenar el documento digital.
  • El sistema permitirá visualizar la plantilla almacenada.
  • El sistema permitirá segmentar el documento par a identificar donde se cargara cada sección de información en la platilla digital. |
- [ ]  Definir requerimientos no funcionales (tecnologias a utilizar, APIS, LLMS, MCP, SERVICIOS DE AWS).
- [ ]