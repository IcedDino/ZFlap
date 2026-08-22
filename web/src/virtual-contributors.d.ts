declare module 'virtual:contributors' {
  export interface Contributor {
    name:    string
    email:   string
    commits: number
    login?:  string
    avatar?: string
    url?:    string
  }

  const contributors: Contributor[]
  export default contributors
}
