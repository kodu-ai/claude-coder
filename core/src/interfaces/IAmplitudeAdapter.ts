interface IAmplitudeAdapter {
	get(key: string): any | undefined
	update(key: string, value: any): Thenable<void>
	getDeviceId(): string
}
