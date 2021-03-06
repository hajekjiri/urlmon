use `urlmon`;
--   ^^^^^^ the name of your database goes here
create table Users (
	id int auto_increment not null,
	username varchar(50) not null,
	email varchar(100) not null,
	accessToken varchar(50) not null,
	primary key (id)
);

create table MonitoredEndpoints (
	id int auto_increment not null,
	name varchar(100) not null,
	url varchar(100) not null,
	createdDate datetime not null,
	lastCheckedDate datetime,
	monitoringInterval int not null,
	ownerId int not null,
	primary key (id),
	foreign key (ownerId) references Users(id)
);

create table MonitoringResults (
	id int auto_increment not null,
	checkedDate datetime not null,
	httpCode int,
	contentType varchar(100),
	payload longtext,
	error varchar(200),
	monitoredEndpointId int not null,
	primary key (id),
	foreign key (monitoredEndpointId) references MonitoredEndpoints(id)
);

insert into Users values (null, 'Applifting', 'info@applifting.cz', '93f39e2f-80de-4033-99ee-249d92736a25');
insert into Users values (null, 'Batman', 'batman@example.com', 'dcb20f8a-5657-4f1b-9f7f-ce65739b359e');
