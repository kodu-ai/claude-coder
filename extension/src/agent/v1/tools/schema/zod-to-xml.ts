// schema/zod-to-xml.ts
import { ZodSchema, ZodObject, ZodTypeAny } from "zod"

export function zodToXMLSchema(schema: ZodSchema): string {
	if (schema instanceof ZodObject) {
		const shape = schema.shape
		let xmlSchema = '<xs:element name="root">\n<xs:complexType>\n<xs:sequence>\n'
		for (const key in shape) {
			xmlSchema += `<xs:element name="${key}" type="xs:string" minOccurs="1" />\n`
		}
		xmlSchema += "</xs:sequence>\n</xs:complexType>\n</xs:element>"
		return xmlSchema
	}
	throw new Error("Unsupported schema type for XML conversion.")
}
