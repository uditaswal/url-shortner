const sessionIdToUserMap = new Map();

export function setUser(id, user) {
    sessionIdToUserMap.set(id, user)

}

export function getUser(id) {
    console.log(id);
    return sessionIdToUserMap.get(id);
}

