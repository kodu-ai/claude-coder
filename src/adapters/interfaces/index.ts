export interface AdapterTextDocument {
	uri: { fsPath: string }
	isDirty: boolean
	save: () => PromiseLike<boolean>
}
