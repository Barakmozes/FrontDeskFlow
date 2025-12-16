import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
  JSON: { input: any; output: any; }
};

export type Area = {
  __typename?: 'Area';
  children: Array<Area>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  floorPlanImage?: Maybe<Scalars['String']['output']>;
  gridConfig?: Maybe<GridConfig>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Area>;
  parentId?: Maybe<Scalars['String']['output']>;
  restaurant: Restaurant;
  restaurantId?: Maybe<Scalars['String']['output']>;
  tables: Array<Table>;
  updatedAt: Scalars['DateTime']['output'];
  waitlists: Array<Waitlist>;
};

export type AreaOrderByInput = {
  createdAt?: InputMaybe<SortOrder>;
};

export type BasicArea = {
  __typename?: 'BasicArea';
  createdAt: Scalars['DateTime']['output'];
  floorPlanImage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Category = {
  __typename?: 'Category';
  desc: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  img: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type Favorite = {
  __typename?: 'Favorite';
  id: Scalars['String']['output'];
  menu: Array<Scalars['String']['output']>;
  user: User;
  userEmail: Scalars['String']['output'];
};

export type GridConfig = {
  __typename?: 'GridConfig';
  area: Area;
  areaId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  gridSize: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Menu = {
  __typename?: 'Menu';
  category: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  image: Scalars['String']['output'];
  longDescr?: Maybe<Scalars['String']['output']>;
  onPromo: Scalars['Boolean']['output'];
  prepType: Array<Scalars['String']['output']>;
  price: Scalars['Float']['output'];
  sellingPrice?: Maybe<Scalars['Float']['output']>;
  shortDescr: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addArea: Area;
  addCategory: Category;
  addFavorite: Favorite;
  addGridConfig: GridConfig;
  addMenu: Menu;
  addNotification: Notification;
  addOrder: Order;
  addOrderToTable: Order;
  addProfile: Profile;
  addReservation: Reservation;
  addRestaurant: Restaurant;
  addTable: Table;
  addTableUsage: TableUsage;
  addWaitlistEntry: Waitlist;
  callWaitlistEntry: Waitlist;
  cancelReservation: Reservation;
  cancelWaitlistEntry: Waitlist;
  completeReservation: Reservation;
  deleteArea: Area;
  deleteCategory: Category;
  deleteGridConfig: GridConfig;
  deleteMenu: Menu;
  deleteNotification: Notification;
  deleteRestaurant: Restaurant;
  deleteTable: Table;
  deleteTableUsage: TableUsage;
  deleteUser: User;
  editArea: Area;
  editCategory: Category;
  editGridConfig: GridConfig;
  editMenu: Menu;
  editOrder: Order;
  editOrderOnPayment: Order;
  editProfile: Profile;
  editReservation: Reservation;
  editRestaurant: Restaurant;
  editTable: Table;
  editUserRole: User;
  incrementUsageCount: TableUsage;
  markNotificationAsRead: Notification;
  movePositionTable: Table;
  removeFavorite: Favorite;
  removeWaitlistEntry: Waitlist;
  seatWaitlistEntry: Waitlist;
  toggleTableReservation: Table;
  updateManyTables: Array<Table>;
  updateNotification: Notification;
  updateTableUsage: TableUsage;
  updateUserProfile: User;
  updateWaitlistEntry: Waitlist;
};


export type MutationAddAreaArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  floorPlanImage?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['String']['input']>;
  restaurantId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAddCategoryArgs = {
  desc: Scalars['String']['input'];
  img: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationAddFavoriteArgs = {
  menuId: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
};


export type MutationAddGridConfigArgs = {
  areaId: Scalars['String']['input'];
  gridSize?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationAddMenuArgs = {
  category: Scalars['String']['input'];
  image: Scalars['String']['input'];
  longDescr: Scalars['String']['input'];
  prepType: Array<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  sellingPrice?: InputMaybe<Scalars['Float']['input']>;
  shortDescr: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationAddNotificationArgs = {
  message: Scalars['String']['input'];
  priority?: InputMaybe<NotificationPriority>;
  status?: InputMaybe<NotificationStatus>;
  type: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
};


export type MutationAddOrderArgs = {
  cart: Scalars['JSON']['input'];
  deliveryAddress: Scalars['String']['input'];
  deliveryFee: Scalars['Float']['input'];
  discount?: InputMaybe<Scalars['Float']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  orderNumber: Scalars['String']['input'];
  paymentToken?: InputMaybe<Scalars['String']['input']>;
  serviceFee: Scalars['Float']['input'];
  total: Scalars['Float']['input'];
  userEmail: Scalars['String']['input'];
  userName: Scalars['String']['input'];
  userPhone: Scalars['String']['input'];
};


export type MutationAddOrderToTableArgs = {
  cart: Scalars['JSON']['input'];
  discount?: InputMaybe<Scalars['Float']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  orderNumber: Scalars['String']['input'];
  paymentToken?: InputMaybe<Scalars['String']['input']>;
  serviceFee: Scalars['Float']['input'];
  tableId: Scalars['String']['input'];
  total: Scalars['Float']['input'];
  userEmail: Scalars['String']['input'];
  userName: Scalars['String']['input'];
};


export type MutationAddProfileArgs = {
  email: Scalars['String']['input'];
  img?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAddReservationArgs = {
  createdBy: Role;
  createdByUserEmail?: InputMaybe<Scalars['String']['input']>;
  numOfDiners: Scalars['Int']['input'];
  reservationTime: Scalars['DateTime']['input'];
  tableId: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
};


export type MutationAddRestaurantArgs = {
  address?: InputMaybe<Scalars['String']['input']>;
  bannerImg?: InputMaybe<Scalars['String']['input']>;
  deliveryFee?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  openTimes?: InputMaybe<Scalars['JSON']['input']>;
  rating?: InputMaybe<Scalars['Float']['input']>;
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
};


export type MutationAddTableArgs = {
  areaId: Scalars['String']['input'];
  diners: Scalars['Int']['input'];
  position?: InputMaybe<Scalars['JSON']['input']>;
  reserved?: InputMaybe<Scalars['Boolean']['input']>;
  specialRequests?: InputMaybe<Array<Scalars['String']['input']>>;
  tableNumber: Scalars['Int']['input'];
};


export type MutationAddTableUsageArgs = {
  lastUsed?: InputMaybe<Scalars['DateTime']['input']>;
  tableId: Scalars['String']['input'];
  usageCount?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationAddWaitlistEntryArgs = {
  areaId: Scalars['String']['input'];
  numOfDiners: Scalars['Int']['input'];
  priority?: InputMaybe<Scalars['Int']['input']>;
  userEmail: Scalars['String']['input'];
};


export type MutationCallWaitlistEntryArgs = {
  id: Scalars['String']['input'];
};


export type MutationCancelReservationArgs = {
  id: Scalars['String']['input'];
};


export type MutationCancelWaitlistEntryArgs = {
  id: Scalars['String']['input'];
};


export type MutationCompleteReservationArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteAreaArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteCategoryArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteGridConfigArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMenuArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteNotificationArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteRestaurantArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteTableArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteTableUsageArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['String']['input'];
};


export type MutationEditAreaArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  floorPlanImage?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['String']['input']>;
  restaurantId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEditCategoryArgs = {
  desc: Scalars['String']['input'];
  id: Scalars['String']['input'];
  img: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationEditGridConfigArgs = {
  gridSize?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type MutationEditMenuArgs = {
  category: Scalars['String']['input'];
  id: Scalars['String']['input'];
  image: Scalars['String']['input'];
  longDescr: Scalars['String']['input'];
  prepType: Array<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  sellingPrice?: InputMaybe<Scalars['Float']['input']>;
  shortDescr: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationEditOrderArgs = {
  deliveryTime?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['String']['input'];
  status: OrderStatus;
};


export type MutationEditOrderOnPaymentArgs = {
  id: Scalars['String']['input'];
  paymentToken?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEditProfileArgs = {
  email: Scalars['String']['input'];
  img?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEditReservationArgs = {
  id: Scalars['String']['input'];
  numOfDiners?: InputMaybe<Scalars['Int']['input']>;
  reservationTime?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<ReservationStatus>;
};


export type MutationEditRestaurantArgs = {
  address?: InputMaybe<Scalars['String']['input']>;
  bannerImg?: InputMaybe<Scalars['String']['input']>;
  deliveryFee?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  openTimes?: InputMaybe<Scalars['JSON']['input']>;
  rating?: InputMaybe<Scalars['Float']['input']>;
  serviceFee?: InputMaybe<Scalars['Float']['input']>;
};


export type MutationEditTableArgs = {
  areaId?: InputMaybe<Scalars['String']['input']>;
  diners?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
  position?: InputMaybe<Scalars['JSON']['input']>;
  reserved?: InputMaybe<Scalars['Boolean']['input']>;
  specialRequests?: InputMaybe<Array<Scalars['String']['input']>>;
  tableNumber?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationEditUserRoleArgs = {
  id: Scalars['String']['input'];
  role: Role;
};


export type MutationIncrementUsageCountArgs = {
  id: Scalars['String']['input'];
  setLastUsed?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationMarkNotificationAsReadArgs = {
  id: Scalars['String']['input'];
};


export type MutationMovePositionTableArgs = {
  id: Scalars['String']['input'];
  position: Scalars['JSON']['input'];
};


export type MutationRemoveFavoriteArgs = {
  menuId: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
};


export type MutationRemoveWaitlistEntryArgs = {
  id: Scalars['String']['input'];
};


export type MutationSeatWaitlistEntryArgs = {
  id: Scalars['String']['input'];
};


export type MutationToggleTableReservationArgs = {
  id: Scalars['String']['input'];
  reserved: Scalars['Boolean']['input'];
};


export type MutationUpdateManyTablesArgs = {
  updates: Array<UpdateManyTablesInput>;
};


export type MutationUpdateNotificationArgs = {
  id: Scalars['String']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<NotificationPriority>;
  status?: InputMaybe<NotificationStatus>;
};


export type MutationUpdateTableUsageArgs = {
  id: Scalars['String']['input'];
  lastUsed?: InputMaybe<Scalars['DateTime']['input']>;
  usageCount?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationUpdateUserProfileArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  image?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateWaitlistEntryArgs = {
  id: Scalars['String']['input'];
  numOfDiners?: InputMaybe<Scalars['Int']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<WaitlistStatus>;
};

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  priority: NotificationPriority;
  status: NotificationStatus;
  type: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userEmail: Scalars['String']['output'];
};

/** The priority of a notification */
export enum NotificationPriority {
  High = 'HIGH',
  Low = 'LOW',
  Normal = 'NORMAL'
}

/** The status of a notification */
export enum NotificationStatus {
  Read = 'READ',
  Unread = 'UNREAD'
}

export type Order = {
  __typename?: 'Order';
  cart: Scalars['JSON']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveryAddress: Scalars['String']['output'];
  deliveryFee: Scalars['Float']['output'];
  deliveryTime?: Maybe<Scalars['DateTime']['output']>;
  discount?: Maybe<Scalars['Float']['output']>;
  id: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  orderDate: Scalars['DateTime']['output'];
  orderNumber: Scalars['String']['output'];
  paid: Scalars['Boolean']['output'];
  paymentToken?: Maybe<Scalars['String']['output']>;
  serviceFee: Scalars['Float']['output'];
  status: OrderStatus;
  table?: Maybe<Table>;
  tableId?: Maybe<Scalars['String']['output']>;
  total: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userEmail: Scalars['String']['output'];
  userName: Scalars['String']['output'];
  userPhone: Scalars['String']['output'];
};

/** All possible statuses an order can have. */
export enum OrderStatus {
  Cancelled = 'CANCELLED',
  Collected = 'COLLECTED',
  Completed = 'COMPLETED',
  Delivered = 'DELIVERED',
  Pending = 'PENDING',
  Preparing = 'PREPARING',
  Ready = 'READY',
  Served = 'SERVED',
  Unassigned = 'UNASSIGNED'
}

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Profile = {
  __typename?: 'Profile';
  email: User;
  id: Scalars['ID']['output'];
  img?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  getAllTableUsages: Array<TableUsage>;
  getArea: Area;
  getAreas: Array<Area>;
  getAreasNameDescription: Array<BasicArea>;
  getAvailableTables: Array<Table>;
  getCategories: Array<Category>;
  getCategory: Category;
  getChildAreas: Array<Area>;
  getFavorites: Array<Favorite>;
  getGridConfig: GridConfig;
  getGridConfigByArea?: Maybe<GridConfig>;
  getGridConfigs: Array<GridConfig>;
  getMenu: Menu;
  getMenuUserFavorites: Array<Menu>;
  getMenus: QueryGetMenusConnection;
  getNotification: Notification;
  getNotifications: Array<Notification>;
  getOrder: Order;
  getOrders: QueryGetOrdersConnection;
  getParentArea?: Maybe<Area>;
  getProfile: Profile;
  getProfiles: Array<Profile>;
  getReservation: Reservation;
  getReservations: Array<Reservation>;
  getRestaurant: Restaurant;
  getRestaurants: Array<Restaurant>;
  getTable: Table;
  getTableOrder: Array<Order>;
  getTableReservations: Array<Reservation>;
  getTableUsage: TableUsage;
  getTableUsageByTable?: Maybe<TableUsage>;
  getTables: Array<Table>;
  getUser: User;
  getUserFavorites: Favorite;
  getUserNotifications: Array<Notification>;
  getUserReservations: Array<Reservation>;
  getUserWaitlistEntries: Array<Waitlist>;
  getUsers: Array<User>;
  getWaitlist: Waitlist;
  getWaitlists: Array<Waitlist>;
  searchRestaurants: Array<Restaurant>;
};


export type QueryGetAreaArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetAreasNameDescriptionArgs = {
  orderBy?: InputMaybe<AreaOrderByInput>;
};


export type QueryGetCategoryArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetChildAreasArgs = {
  parentId: Scalars['String']['input'];
};


export type QueryGetGridConfigArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetGridConfigByAreaArgs = {
  areaId: Scalars['String']['input'];
};


export type QueryGetMenuArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetMenuUserFavoritesArgs = {
  menuIds: Array<Scalars['String']['input']>;
  userEmail: Scalars['String']['input'];
};


export type QueryGetMenusArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetNotificationArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetOrderArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetOrdersArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  before?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetParentAreaArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetProfileArgs = {
  email: Scalars['String']['input'];
};


export type QueryGetReservationArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetReservationsArgs = {
  status?: InputMaybe<ReservationStatus>;
};


export type QueryGetRestaurantArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetTableArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetTableOrderArgs = {
  tableId: Scalars['String']['input'];
};


export type QueryGetTableReservationsArgs = {
  date: Scalars['String']['input'];
  tableId: Scalars['String']['input'];
};


export type QueryGetTableUsageArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetTableUsageByTableArgs = {
  tableId: Scalars['String']['input'];
};


export type QueryGetUserArgs = {
  email: Scalars['String']['input'];
};


export type QueryGetUserFavoritesArgs = {
  userEmail: Scalars['String']['input'];
};


export type QueryGetUserNotificationsArgs = {
  userEmail: Scalars['String']['input'];
};


export type QueryGetUserReservationsArgs = {
  userEmail: Scalars['String']['input'];
};


export type QueryGetUserWaitlistEntriesArgs = {
  userEmail: Scalars['String']['input'];
};


export type QueryGetWaitlistArgs = {
  id: Scalars['String']['input'];
};


export type QuerySearchRestaurantsArgs = {
  keyword: Scalars['String']['input'];
};

export type QueryGetMenusConnection = {
  __typename?: 'QueryGetMenusConnection';
  edges: Array<Maybe<QueryGetMenusConnectionEdge>>;
  pageInfo: PageInfo;
};

export type QueryGetMenusConnectionEdge = {
  __typename?: 'QueryGetMenusConnectionEdge';
  cursor: Scalars['String']['output'];
  node: Menu;
};

export type QueryGetOrdersConnection = {
  __typename?: 'QueryGetOrdersConnection';
  edges: Array<Maybe<QueryGetOrdersConnectionEdge>>;
  pageInfo: PageInfo;
};

export type QueryGetOrdersConnectionEdge = {
  __typename?: 'QueryGetOrdersConnectionEdge';
  cursor: Scalars['String']['output'];
  node: Order;
};

export type Reservation = {
  __typename?: 'Reservation';
  createdAt: Scalars['DateTime']['output'];
  createdBy: Scalars['String']['output'];
  createdByUser?: Maybe<User>;
  createdByUserEmail?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  numOfDiners: Scalars['Int']['output'];
  reservationTime: Scalars['DateTime']['output'];
  status: ReservationStatus;
  table: Table;
  tableId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userEmail: Scalars['String']['output'];
};

/** The status of a reservation */
export enum ReservationStatus {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Confirmed = 'CONFIRMED',
  Pending = 'PENDING'
}

export type Restaurant = {
  __typename?: 'Restaurant';
  address?: Maybe<Scalars['String']['output']>;
  areas: Array<Area>;
  bannerImg: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deliveryFee: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  openTimes: Scalars['JSON']['output'];
  rating: Scalars['Float']['output'];
  serviceFee: Scalars['Float']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

/** User roles in the system */
export enum Role {
  Admin = 'ADMIN',
  Chef = 'CHEF',
  Delivery = 'DELIVERY',
  Manager = 'MANAGER',
  User = 'USER',
  Waiter = 'WAITER'
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc'
}

export type Table = {
  __typename?: 'Table';
  area: Area;
  areaId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  diners: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  orders: Array<Order>;
  position: Scalars['JSON']['output'];
  reservations: Array<Reservation>;
  reserved: Scalars['Boolean']['output'];
  specialRequests: Array<Scalars['String']['output']>;
  tableNumber: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageStats?: Maybe<TableUsage>;
};

export type TableUsage = {
  __typename?: 'TableUsage';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastUsed?: Maybe<Scalars['DateTime']['output']>;
  table: Table;
  tableId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
};

export type UpdateManyTablesInput = {
  areaId?: InputMaybe<Scalars['String']['input']>;
  diners?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
  position?: InputMaybe<Scalars['JSON']['input']>;
  reserved?: InputMaybe<Scalars['Boolean']['input']>;
  specialRequests?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['DateTime']['output'];
  createdReservations?: Maybe<Array<Reservation>>;
  email?: Maybe<Scalars['String']['output']>;
  favorite?: Maybe<Favorite>;
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  notifications?: Maybe<Array<Notification>>;
  order: Array<Order>;
  profile?: Maybe<Profile>;
  reservations?: Maybe<Array<Reservation>>;
  role: Role;
  updatedAt: Scalars['DateTime']['output'];
  waitlists?: Maybe<Array<Waitlist>>;
};

export type Waitlist = {
  __typename?: 'Waitlist';
  area: Area;
  areaId: Scalars['String']['output'];
  calledAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  numOfDiners: Scalars['Int']['output'];
  priority?: Maybe<Scalars['Int']['output']>;
  seatedAt?: Maybe<Scalars['DateTime']['output']>;
  status: WaitlistStatus;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userEmail: Scalars['String']['output'];
};

/** Status of a waitlist entry */
export enum WaitlistStatus {
  Called = 'CALLED',
  Cancelled = 'CANCELLED',
  Seated = 'SEATED',
  Waiting = 'WAITING'
}

export type GetAreaQueryVariables = Exact<{
  getAreaId: Scalars['String']['input'];
}>;


export type GetAreaQuery = { __typename?: 'Query', getArea: { __typename?: 'Area', description?: string | null, floorPlanImage?: string | null, name: string, updatedAt: any, id: string, tables: Array<{ __typename?: 'Table', diners: number, tableNumber: number, position: any, reserved: boolean, specialRequests: Array<string>, id: string }> } };

export type GetAreasQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAreasQuery = { __typename?: 'Query', getAreas: Array<{ __typename?: 'Area', updatedAt: any, name: string, id: string, floorPlanImage?: string | null, description?: string | null, tables: Array<{ __typename?: 'Table', diners: number, id: string, position: any, reserved: boolean, specialRequests: Array<string>, tableNumber: number }> }> };

export type AddAreaMutationVariables = Exact<{
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type AddAreaMutation = { __typename?: 'Mutation', addArea: { __typename?: 'Area', id: string } };

export type DeleteAreaMutationVariables = Exact<{
  deleteAreaId: Scalars['String']['input'];
}>;


export type DeleteAreaMutation = { __typename?: 'Mutation', deleteArea: { __typename?: 'Area', name: string, id: string } };

export type EditAreaMutationVariables = Exact<{
  editAreaId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  floorPlanImage?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type EditAreaMutation = { __typename?: 'Mutation', editArea: { __typename?: 'Area', id: string } };

export type GetAreasNameDescriptionQueryVariables = Exact<{
  orderBy?: InputMaybe<AreaOrderByInput>;
}>;


export type GetAreasNameDescriptionQuery = { __typename?: 'Query', getAreasNameDescription: Array<{ __typename?: 'BasicArea', createdAt: any, floorPlanImage?: string | null, id: string, name: string }> };

export type GetUserFavoritesQueryVariables = Exact<{
  userEmail: Scalars['String']['input'];
}>;


export type GetUserFavoritesQuery = { __typename?: 'Query', getUserFavorites: { __typename?: 'Favorite', id: string, menu: Array<string>, userEmail: string } };

export type AddFavoriteMutationVariables = Exact<{
  menuId: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
}>;


export type AddFavoriteMutation = { __typename?: 'Mutation', addFavorite: { __typename?: 'Favorite', id: string, menu: Array<string> } };

export type RemoveFavoriteMutationVariables = Exact<{
  menuId: Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
}>;


export type RemoveFavoriteMutation = { __typename?: 'Mutation', removeFavorite: { __typename?: 'Favorite', id: string, menu: Array<string> } };

export type AddMenuMutationVariables = Exact<{
  category: Scalars['String']['input'];
  image: Scalars['String']['input'];
  longDescr: Scalars['String']['input'];
  prepType: Array<Scalars['String']['input']> | Scalars['String']['input'];
  price: Scalars['Float']['input'];
  shortDescr: Scalars['String']['input'];
  title: Scalars['String']['input'];
  sellingPrice?: InputMaybe<Scalars['Float']['input']>;
}>;


export type AddMenuMutation = { __typename?: 'Mutation', addMenu: { __typename?: 'Menu', id: string } };

export type EditMenuMutationVariables = Exact<{
  category: Scalars['String']['input'];
  editMenuId: Scalars['String']['input'];
  image: Scalars['String']['input'];
  longDescr: Scalars['String']['input'];
  prepType: Array<Scalars['String']['input']> | Scalars['String']['input'];
  price: Scalars['Float']['input'];
  shortDescr: Scalars['String']['input'];
  title: Scalars['String']['input'];
  sellingPrice?: InputMaybe<Scalars['Float']['input']>;
}>;


export type EditMenuMutation = { __typename?: 'Mutation', editMenu: { __typename?: 'Menu', id: string } };

export type DeleteMenuMutationVariables = Exact<{
  deleteMenuId: Scalars['String']['input'];
}>;


export type DeleteMenuMutation = { __typename?: 'Mutation', deleteMenu: { __typename?: 'Menu', id: string } };

export type GetMenusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetMenusQuery = { __typename?: 'Query', getMenus: { __typename?: 'QueryGetMenusConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, edges: Array<{ __typename?: 'QueryGetMenusConnectionEdge', cursor: string, node: { __typename?: 'Menu', category: string, id: string, image: string, longDescr?: string | null, onPromo: boolean, prepType: Array<string>, price: number, sellingPrice?: number | null, shortDescr: string, title: string } } | null> } };

export type GetMenuUserFavoritesQueryVariables = Exact<{
  menuIds: Array<Scalars['String']['input']> | Scalars['String']['input'];
  userEmail: Scalars['String']['input'];
}>;


export type GetMenuUserFavoritesQuery = { __typename?: 'Query', getMenuUserFavorites: Array<{ __typename?: 'Menu', category: string, id: string, image: string, longDescr?: string | null, onPromo: boolean, prepType: Array<string>, price: number, sellingPrice?: number | null, shortDescr: string, title: string }> };

export type GetOrdersQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetOrdersQuery = { __typename?: 'Query', getOrders: { __typename?: 'QueryGetOrdersConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, edges: Array<{ __typename?: 'QueryGetOrdersConnectionEdge', cursor: string, node: { __typename?: 'Order', cart: any, deliveryAddress: string, deliveryFee: number, deliveryTime?: any | null, discount?: number | null, id: string, note?: string | null, orderDate: any, orderNumber: string, paid: boolean, paymentToken?: string | null, serviceFee: number, status: OrderStatus, total: number, userEmail: string, userName: string, userPhone: string } } | null> } };

export type AddOrderMutationVariables = Exact<{
  cart: Scalars['JSON']['input'];
  deliveryAddress: Scalars['String']['input'];
  deliveryFee: Scalars['Float']['input'];
  orderNumber: Scalars['String']['input'];
  serviceFee: Scalars['Float']['input'];
  total: Scalars['Float']['input'];
  userEmail: Scalars['String']['input'];
  userName: Scalars['String']['input'];
  userPhone: Scalars['String']['input'];
  discount?: InputMaybe<Scalars['Float']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  paymentToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type AddOrderMutation = { __typename?: 'Mutation', addOrder: { __typename?: 'Order', id: string } };

export type EditOrderOnPaymentMutationVariables = Exact<{
  editOrderOnPaymentId: Scalars['String']['input'];
  paymentToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type EditOrderOnPaymentMutation = { __typename?: 'Mutation', editOrderOnPayment: { __typename?: 'Order', id: string } };

export type EditOrderMutationVariables = Exact<{
  editOrderId: Scalars['String']['input'];
  status: OrderStatus;
  deliveryTime?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type EditOrderMutation = { __typename?: 'Mutation', editOrder: { __typename?: 'Order', id: string } };

export type GetAvailableTablesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAvailableTablesQuery = { __typename?: 'Query', getAvailableTables: Array<{ __typename?: 'Table', areaId: string, id: string, diners: number, tableNumber: number, reservations: Array<{ __typename?: 'Reservation', reservationTime: any }> }> };

export type GetTableQueryVariables = Exact<{
  getTableId: Scalars['String']['input'];
}>;


export type GetTableQuery = { __typename?: 'Query', getTable: { __typename?: 'Table', areaId: string, diners: number, id: string, position: any, reserved: boolean, specialRequests: Array<string>, tableNumber: number, updatedAt: any } };

export type GetTablesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTablesQuery = { __typename?: 'Query', getTables: Array<{ __typename?: 'Table', areaId: string, createdAt: any, diners: number, id: string, position: any, reserved: boolean, specialRequests: Array<string>, tableNumber: number, updatedAt: any }> };

export type GetTableOrderQueryVariables = Exact<{
  tableId: Scalars['String']['input'];
}>;


export type GetTableOrderQuery = { __typename?: 'Query', getTableOrder: Array<{ __typename?: 'Order', cart: any, deliveryTime?: any | null, discount?: number | null, id: string, note?: string | null, orderDate: any, orderNumber: string, paid: boolean, paymentToken?: string | null, serviceFee: number, status: OrderStatus, total: number, userName: string, userPhone: string }> };

export type GetTableReservationsQueryVariables = Exact<{
  date: Scalars['String']['input'];
  tableId: Scalars['String']['input'];
}>;


export type GetTableReservationsQuery = { __typename?: 'Query', getTableReservations: Array<{ __typename?: 'Reservation', reservationTime: any, numOfDiners: number, status: ReservationStatus, userEmail: string, createdBy: string, id: string, user: { __typename?: 'User', profile?: { __typename?: 'Profile', name?: string | null, phone?: string | null } | null } }> };

export type AddTableMutationVariables = Exact<{
  areaId: Scalars['String']['input'];
  diners: Scalars['Int']['input'];
  position: Scalars['JSON']['input'];
  tableNumber: Scalars['Int']['input'];
}>;


export type AddTableMutation = { __typename?: 'Mutation', addTable: { __typename?: 'Table', id: string, tableNumber: number } };

export type DeleteTableMutationVariables = Exact<{
  deleteTableId: Scalars['String']['input'];
}>;


export type DeleteTableMutation = { __typename?: 'Mutation', deleteTable: { __typename?: 'Table', tableNumber: number } };

export type EditTableMutationVariables = Exact<{
  editTableId: Scalars['String']['input'];
  areaId?: InputMaybe<Scalars['String']['input']>;
  diners?: InputMaybe<Scalars['Int']['input']>;
  position?: InputMaybe<Scalars['JSON']['input']>;
  reserved?: InputMaybe<Scalars['Boolean']['input']>;
  specialRequests?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  tableNumber?: InputMaybe<Scalars['Int']['input']>;
}>;


export type EditTableMutation = { __typename?: 'Mutation', editTable: { __typename?: 'Table', id: string, tableNumber: number } };

export type AddOrderToTableMutationVariables = Exact<{
  cart: Scalars['JSON']['input'];
  orderNumber: Scalars['String']['input'];
  serviceFee: Scalars['Float']['input'];
  tableId: Scalars['String']['input'];
  total: Scalars['Float']['input'];
  userEmail: Scalars['String']['input'];
  userName: Scalars['String']['input'];
  discount?: InputMaybe<Scalars['Float']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  paymentToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type AddOrderToTableMutation = { __typename?: 'Mutation', addOrderToTable: { __typename?: 'Order', cart: any, discount?: number | null, note?: string | null, orderNumber: string, paymentToken?: string | null, total: number, userEmail: string, userName: string, id: string } };

export type MovePositionTableMutationVariables = Exact<{
  movePositionTableId: Scalars['String']['input'];
  position: Scalars['JSON']['input'];
}>;


export type MovePositionTableMutation = { __typename?: 'Mutation', movePositionTable: { __typename?: 'Table', id: string } };

export type UpdateManyTablesMutationVariables = Exact<{
  updates: Array<UpdateManyTablesInput> | UpdateManyTablesInput;
}>;


export type UpdateManyTablesMutation = { __typename?: 'Mutation', updateManyTables: Array<{ __typename?: 'Table', id: string, tableNumber: number, position: any, areaId: string, reserved: boolean, diners: number, specialRequests: Array<string> }> };

export type ToggleTableReservationMutationVariables = Exact<{
  toggleTableReservationId: Scalars['String']['input'];
  reserved: Scalars['Boolean']['input'];
}>;


export type ToggleTableReservationMutation = { __typename?: 'Mutation', toggleTableReservation: { __typename?: 'Table', id: string, reserved: boolean } };

export type GetUserQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type GetUserQuery = { __typename?: 'Query', getUser: { __typename?: 'User', email?: string | null, id: string, image?: string | null, name?: string | null, role: Role, order: Array<{ __typename?: 'Order', cart: any, deliveryAddress: string, deliveryFee: number, deliveryTime?: any | null, discount?: number | null, id: string, note?: string | null, orderDate: any, orderNumber: string, paid: boolean, paymentToken?: string | null, serviceFee: number, status: OrderStatus, total: number, userEmail: string, userName: string, userPhone: string, tableId?: string | null }> } };

export type GetProfileQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type GetProfileQuery = { __typename?: 'Query', getProfile: { __typename?: 'Profile', id: string, img?: string | null, name?: string | null, phone?: string | null } };

export type AddProfileMutationVariables = Exact<{
  email: Scalars['String']['input'];
  img?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
}>;


export type AddProfileMutation = { __typename?: 'Mutation', addProfile: { __typename?: 'Profile', id: string } };

export type EditProfileMutationVariables = Exact<{
  email: Scalars['String']['input'];
  img?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
}>;


export type EditProfileMutation = { __typename?: 'Mutation', editProfile: { __typename?: 'Profile', id: string } };


export const GetAreaDocument = gql`
    query GetArea($getAreaId: String!) {
  getArea(id: $getAreaId) {
    description
    floorPlanImage
    name
    updatedAt
    id
    tables {
      diners
      tableNumber
      position
      reserved
      specialRequests
      id
    }
  }
}
    `;

export function useGetAreaQuery(options: Omit<Urql.UseQueryArgs<GetAreaQueryVariables>, 'query'>) {
  return Urql.useQuery<GetAreaQuery, GetAreaQueryVariables>({ query: GetAreaDocument, ...options });
};
export const GetAreasDocument = gql`
    query GetAreas {
  getAreas {
    updatedAt
    name
    id
    floorPlanImage
    description
    tables {
      diners
      id
      position
      reserved
      specialRequests
      tableNumber
    }
  }
}
    `;

export function useGetAreasQuery(options?: Omit<Urql.UseQueryArgs<GetAreasQueryVariables>, 'query'>) {
  return Urql.useQuery<GetAreasQuery, GetAreasQueryVariables>({ query: GetAreasDocument, ...options });
};
export const AddAreaDocument = gql`
    mutation AddArea($name: String!, $description: String) {
  addArea(name: $name, description: $description) {
    id
  }
}
    `;

export function useAddAreaMutation() {
  return Urql.useMutation<AddAreaMutation, AddAreaMutationVariables>(AddAreaDocument);
};
export const DeleteAreaDocument = gql`
    mutation DeleteArea($deleteAreaId: String!) {
  deleteArea(id: $deleteAreaId) {
    name
    id
  }
}
    `;

export function useDeleteAreaMutation() {
  return Urql.useMutation<DeleteAreaMutation, DeleteAreaMutationVariables>(DeleteAreaDocument);
};
export const EditAreaDocument = gql`
    mutation EditArea($editAreaId: String!, $description: String, $floorPlanImage: String, $name: String) {
  editArea(
    id: $editAreaId
    description: $description
    floorPlanImage: $floorPlanImage
    name: $name
  ) {
    id
  }
}
    `;

export function useEditAreaMutation() {
  return Urql.useMutation<EditAreaMutation, EditAreaMutationVariables>(EditAreaDocument);
};
export const GetAreasNameDescriptionDocument = gql`
    query GetAreasNameDescription($orderBy: AreaOrderByInput) {
  getAreasNameDescription(orderBy: $orderBy) {
    createdAt
    floorPlanImage
    id
    name
  }
}
    `;

export function useGetAreasNameDescriptionQuery(options?: Omit<Urql.UseQueryArgs<GetAreasNameDescriptionQueryVariables>, 'query'>) {
  return Urql.useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({ query: GetAreasNameDescriptionDocument, ...options });
};
export const GetUserFavoritesDocument = gql`
    query GetUserFavorites($userEmail: String!) {
  getUserFavorites(userEmail: $userEmail) {
    id
    menu
    userEmail
  }
}
    `;

export function useGetUserFavoritesQuery(options: Omit<Urql.UseQueryArgs<GetUserFavoritesQueryVariables>, 'query'>) {
  return Urql.useQuery<GetUserFavoritesQuery, GetUserFavoritesQueryVariables>({ query: GetUserFavoritesDocument, ...options });
};
export const AddFavoriteDocument = gql`
    mutation AddFavorite($menuId: String!, $userEmail: String!) {
  addFavorite(menuId: $menuId, userEmail: $userEmail) {
    id
    menu
  }
}
    `;

export function useAddFavoriteMutation() {
  return Urql.useMutation<AddFavoriteMutation, AddFavoriteMutationVariables>(AddFavoriteDocument);
};
export const RemoveFavoriteDocument = gql`
    mutation RemoveFavorite($menuId: String!, $userEmail: String!) {
  removeFavorite(menuId: $menuId, userEmail: $userEmail) {
    id
    menu
  }
}
    `;

export function useRemoveFavoriteMutation() {
  return Urql.useMutation<RemoveFavoriteMutation, RemoveFavoriteMutationVariables>(RemoveFavoriteDocument);
};
export const AddMenuDocument = gql`
    mutation AddMenu($category: String!, $image: String!, $longDescr: String!, $prepType: [String!]!, $price: Float!, $shortDescr: String!, $title: String!, $sellingPrice: Float) {
  addMenu(
    category: $category
    image: $image
    longDescr: $longDescr
    prepType: $prepType
    price: $price
    shortDescr: $shortDescr
    title: $title
    sellingPrice: $sellingPrice
  ) {
    id
  }
}
    `;

export function useAddMenuMutation() {
  return Urql.useMutation<AddMenuMutation, AddMenuMutationVariables>(AddMenuDocument);
};
export const EditMenuDocument = gql`
    mutation EditMenu($category: String!, $editMenuId: String!, $image: String!, $longDescr: String!, $prepType: [String!]!, $price: Float!, $shortDescr: String!, $title: String!, $sellingPrice: Float) {
  editMenu(
    category: $category
    id: $editMenuId
    image: $image
    longDescr: $longDescr
    prepType: $prepType
    price: $price
    shortDescr: $shortDescr
    title: $title
    sellingPrice: $sellingPrice
  ) {
    id
  }
}
    `;

export function useEditMenuMutation() {
  return Urql.useMutation<EditMenuMutation, EditMenuMutationVariables>(EditMenuDocument);
};
export const DeleteMenuDocument = gql`
    mutation DeleteMenu($deleteMenuId: String!) {
  deleteMenu(id: $deleteMenuId) {
    id
  }
}
    `;

export function useDeleteMenuMutation() {
  return Urql.useMutation<DeleteMenuMutation, DeleteMenuMutationVariables>(DeleteMenuDocument);
};
export const GetMenusDocument = gql`
    query GetMenus($first: Int, $after: ID) {
  getMenus(first: $first, after: $after) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      cursor
      node {
        category
        id
        image
        longDescr
        onPromo
        prepType
        price
        sellingPrice
        shortDescr
        title
      }
    }
  }
}
    `;

export function useGetMenusQuery(options?: Omit<Urql.UseQueryArgs<GetMenusQueryVariables>, 'query'>) {
  return Urql.useQuery<GetMenusQuery, GetMenusQueryVariables>({ query: GetMenusDocument, ...options });
};
export const GetMenuUserFavoritesDocument = gql`
    query GetMenuUserFavorites($menuIds: [String!]!, $userEmail: String!) {
  getMenuUserFavorites(menuIds: $menuIds, userEmail: $userEmail) {
    category
    id
    image
    longDescr
    onPromo
    prepType
    price
    sellingPrice
    shortDescr
    title
  }
}
    `;

export function useGetMenuUserFavoritesQuery(options: Omit<Urql.UseQueryArgs<GetMenuUserFavoritesQueryVariables>, 'query'>) {
  return Urql.useQuery<GetMenuUserFavoritesQuery, GetMenuUserFavoritesQueryVariables>({ query: GetMenuUserFavoritesDocument, ...options });
};
export const GetOrdersDocument = gql`
    query GetOrders($first: Int, $after: ID) {
  getOrders(first: $first, after: $after) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      cursor
      node {
        cart
        deliveryAddress
        deliveryFee
        deliveryTime
        discount
        id
        note
        orderDate
        orderNumber
        paid
        paymentToken
        serviceFee
        status
        total
        userEmail
        userName
        userPhone
      }
    }
  }
}
    `;

export function useGetOrdersQuery(options?: Omit<Urql.UseQueryArgs<GetOrdersQueryVariables>, 'query'>) {
  return Urql.useQuery<GetOrdersQuery, GetOrdersQueryVariables>({ query: GetOrdersDocument, ...options });
};
export const AddOrderDocument = gql`
    mutation AddOrder($cart: JSON!, $deliveryAddress: String!, $deliveryFee: Float!, $orderNumber: String!, $serviceFee: Float!, $total: Float!, $userEmail: String!, $userName: String!, $userPhone: String!, $discount: Float, $note: String, $paymentToken: String) {
  addOrder(
    cart: $cart
    deliveryAddress: $deliveryAddress
    deliveryFee: $deliveryFee
    orderNumber: $orderNumber
    serviceFee: $serviceFee
    total: $total
    userEmail: $userEmail
    userName: $userName
    userPhone: $userPhone
    discount: $discount
    note: $note
    paymentToken: $paymentToken
  ) {
    id
  }
}
    `;

export function useAddOrderMutation() {
  return Urql.useMutation<AddOrderMutation, AddOrderMutationVariables>(AddOrderDocument);
};
export const EditOrderOnPaymentDocument = gql`
    mutation EditOrderOnPayment($editOrderOnPaymentId: String!, $paymentToken: String) {
  editOrderOnPayment(id: $editOrderOnPaymentId, paymentToken: $paymentToken) {
    id
  }
}
    `;

export function useEditOrderOnPaymentMutation() {
  return Urql.useMutation<EditOrderOnPaymentMutation, EditOrderOnPaymentMutationVariables>(EditOrderOnPaymentDocument);
};
export const EditOrderDocument = gql`
    mutation EditOrder($editOrderId: String!, $status: OrderStatus!, $deliveryTime: DateTime) {
  editOrder(id: $editOrderId, status: $status, deliveryTime: $deliveryTime) {
    id
  }
}
    `;

export function useEditOrderMutation() {
  return Urql.useMutation<EditOrderMutation, EditOrderMutationVariables>(EditOrderDocument);
};
export const GetAvailableTablesDocument = gql`
    query GetAvailableTables {
  getAvailableTables {
    areaId
    id
    diners
    tableNumber
    reservations {
      reservationTime
    }
  }
}
    `;

export function useGetAvailableTablesQuery(options?: Omit<Urql.UseQueryArgs<GetAvailableTablesQueryVariables>, 'query'>) {
  return Urql.useQuery<GetAvailableTablesQuery, GetAvailableTablesQueryVariables>({ query: GetAvailableTablesDocument, ...options });
};
export const GetTableDocument = gql`
    query GetTable($getTableId: String!) {
  getTable(id: $getTableId) {
    areaId
    diners
    id
    position
    reserved
    specialRequests
    tableNumber
    updatedAt
  }
}
    `;

export function useGetTableQuery(options: Omit<Urql.UseQueryArgs<GetTableQueryVariables>, 'query'>) {
  return Urql.useQuery<GetTableQuery, GetTableQueryVariables>({ query: GetTableDocument, ...options });
};
export const GetTablesDocument = gql`
    query GetTables {
  getTables {
    areaId
    createdAt
    diners
    id
    position
    reserved
    specialRequests
    tableNumber
    updatedAt
  }
}
    `;

export function useGetTablesQuery(options?: Omit<Urql.UseQueryArgs<GetTablesQueryVariables>, 'query'>) {
  return Urql.useQuery<GetTablesQuery, GetTablesQueryVariables>({ query: GetTablesDocument, ...options });
};
export const GetTableOrderDocument = gql`
    query GetTableOrder($tableId: String!) {
  getTableOrder(tableId: $tableId) {
    cart
    deliveryTime
    discount
    id
    note
    orderDate
    orderNumber
    paid
    paymentToken
    serviceFee
    status
    total
    userName
    userPhone
  }
}
    `;

export function useGetTableOrderQuery(options: Omit<Urql.UseQueryArgs<GetTableOrderQueryVariables>, 'query'>) {
  return Urql.useQuery<GetTableOrderQuery, GetTableOrderQueryVariables>({ query: GetTableOrderDocument, ...options });
};
export const GetTableReservationsDocument = gql`
    query GetTableReservations($date: String!, $tableId: String!) {
  getTableReservations(date: $date, tableId: $tableId) {
    reservationTime
    numOfDiners
    status
    userEmail
    createdBy
    id
    user {
      profile {
        name
        phone
      }
    }
  }
}
    `;

export function useGetTableReservationsQuery(options: Omit<Urql.UseQueryArgs<GetTableReservationsQueryVariables>, 'query'>) {
  return Urql.useQuery<GetTableReservationsQuery, GetTableReservationsQueryVariables>({ query: GetTableReservationsDocument, ...options });
};
export const AddTableDocument = gql`
    mutation AddTable($areaId: String!, $diners: Int!, $position: JSON!, $tableNumber: Int!) {
  addTable(
    areaId: $areaId
    diners: $diners
    position: $position
    tableNumber: $tableNumber
  ) {
    id
    tableNumber
  }
}
    `;

export function useAddTableMutation() {
  return Urql.useMutation<AddTableMutation, AddTableMutationVariables>(AddTableDocument);
};
export const DeleteTableDocument = gql`
    mutation DeleteTable($deleteTableId: String!) {
  deleteTable(id: $deleteTableId) {
    tableNumber
  }
}
    `;

export function useDeleteTableMutation() {
  return Urql.useMutation<DeleteTableMutation, DeleteTableMutationVariables>(DeleteTableDocument);
};
export const EditTableDocument = gql`
    mutation EditTable($editTableId: String!, $areaId: String, $diners: Int, $position: JSON, $reserved: Boolean, $specialRequests: [String!], $tableNumber: Int) {
  editTable(
    id: $editTableId
    areaId: $areaId
    diners: $diners
    position: $position
    reserved: $reserved
    specialRequests: $specialRequests
    tableNumber: $tableNumber
  ) {
    id
    tableNumber
  }
}
    `;

export function useEditTableMutation() {
  return Urql.useMutation<EditTableMutation, EditTableMutationVariables>(EditTableDocument);
};
export const AddOrderToTableDocument = gql`
    mutation AddOrderToTable($cart: JSON!, $orderNumber: String!, $serviceFee: Float!, $tableId: String!, $total: Float!, $userEmail: String!, $userName: String!, $discount: Float, $note: String, $paymentToken: String) {
  addOrderToTable(
    cart: $cart
    orderNumber: $orderNumber
    serviceFee: $serviceFee
    tableId: $tableId
    total: $total
    userEmail: $userEmail
    userName: $userName
    discount: $discount
    note: $note
    paymentToken: $paymentToken
  ) {
    cart
    discount
    note
    orderNumber
    paymentToken
    total
    userEmail
    userName
    id
  }
}
    `;

export function useAddOrderToTableMutation() {
  return Urql.useMutation<AddOrderToTableMutation, AddOrderToTableMutationVariables>(AddOrderToTableDocument);
};
export const MovePositionTableDocument = gql`
    mutation MovePositionTable($movePositionTableId: String!, $position: JSON!) {
  movePositionTable(id: $movePositionTableId, position: $position) {
    id
  }
}
    `;

export function useMovePositionTableMutation() {
  return Urql.useMutation<MovePositionTableMutation, MovePositionTableMutationVariables>(MovePositionTableDocument);
};
export const UpdateManyTablesDocument = gql`
    mutation UpdateManyTables($updates: [UpdateManyTablesInput!]!) {
  updateManyTables(updates: $updates) {
    id
    tableNumber
    position
    areaId
    reserved
    diners
    specialRequests
  }
}
    `;

export function useUpdateManyTablesMutation() {
  return Urql.useMutation<UpdateManyTablesMutation, UpdateManyTablesMutationVariables>(UpdateManyTablesDocument);
};
export const ToggleTableReservationDocument = gql`
    mutation ToggleTableReservation($toggleTableReservationId: String!, $reserved: Boolean!) {
  toggleTableReservation(id: $toggleTableReservationId, reserved: $reserved) {
    id
    reserved
  }
}
    `;

export function useToggleTableReservationMutation() {
  return Urql.useMutation<ToggleTableReservationMutation, ToggleTableReservationMutationVariables>(ToggleTableReservationDocument);
};
export const GetUserDocument = gql`
    query GetUser($email: String!) {
  getUser(email: $email) {
    email
    id
    image
    name
    role
    order {
      cart
      deliveryAddress
      deliveryFee
      deliveryTime
      discount
      id
      note
      orderDate
      orderNumber
      paid
      paymentToken
      serviceFee
      status
      total
      userEmail
      userName
      userPhone
      tableId
    }
  }
}
    `;

export function useGetUserQuery(options: Omit<Urql.UseQueryArgs<GetUserQueryVariables>, 'query'>) {
  return Urql.useQuery<GetUserQuery, GetUserQueryVariables>({ query: GetUserDocument, ...options });
};
export const GetProfileDocument = gql`
    query GetProfile($email: String!) {
  getProfile(email: $email) {
    id
    img
    name
    phone
  }
}
    `;

export function useGetProfileQuery(options: Omit<Urql.UseQueryArgs<GetProfileQueryVariables>, 'query'>) {
  return Urql.useQuery<GetProfileQuery, GetProfileQueryVariables>({ query: GetProfileDocument, ...options });
};
export const AddProfileDocument = gql`
    mutation AddProfile($email: String!, $img: String, $name: String, $phone: String) {
  addProfile(email: $email, img: $img, name: $name, phone: $phone) {
    id
  }
}
    `;

export function useAddProfileMutation() {
  return Urql.useMutation<AddProfileMutation, AddProfileMutationVariables>(AddProfileDocument);
};
export const EditProfileDocument = gql`
    mutation EditProfile($email: String!, $img: String, $name: String, $phone: String) {
  editProfile(email: $email, img: $img, name: $name, phone: $phone) {
    id
  }
}
    `;

export function useEditProfileMutation() {
  return Urql.useMutation<EditProfileMutation, EditProfileMutationVariables>(EditProfileDocument);
};