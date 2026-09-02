{{- define "sstore.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sstore.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "sstore.name" . -}}
{{- end -}}
{{- end -}}

{{- define "sstore.labels" -}}
app.kubernetes.io/name: {{ include "sstore.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: sstore
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "sstore.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sstore.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
